import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { createServer } from "../apps/api/dist/server.js";
import { EvidenceRepository } from "../apps/api/dist/evidence/evidenceRepository.js";
import { evaluateRequirement } from "../apps/api/dist/evaluation/evaluate.js";
import { OperationOutcomeError } from "../apps/api/dist/errors.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { QuestionnaireService } from "../apps/api/dist/questionnaires/questionnaireService.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";
import { SubmissionService } from "../apps/api/dist/submissions/submissionService.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

function createFixture() {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const result = store.saveEvaluation(goldenScenario.request, evaluateRequirement(goldenScenario.request, repository));
  const workItem = store.createWorkItem({ evaluationId: result.evaluationId, ownerUserId: "m7-test-operator" });
  const uploadDir = mkdtempSync(join(tmpdir(), "opa-evidence-"));
  const evidenceRepository = new EvidenceRepository(store, uploadDir);
  const questionnaireService = new QuestionnaireService(repository, store);
  const submissionService = new SubmissionService(repository, store);
  return { evidenceRepository, questionnaireService, repository, store, submissionService, uploadDir, workItem };
}

function cleanup(fixture) {
  rmSync(fixture.uploadDir, { recursive: true, force: true });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setAnswer(response, linkId, answer) {
  const item = response.item.find((candidate) => candidate.linkId === linkId);
  assert.ok(item, `Expected response item ${linkId}`);
  item.answer = [answer];
  return response;
}

function completeResponse(response) {
  setAnswer(response, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: "routine",
      display: "Routine"
    }
  });
  setAnswer(response, "prior-spine-surgery", { valueBoolean: false });
  return response;
}

function markReady(fixture) {
  const pkg = fixture.questionnaireService.getPackage(fixture.workItem.id);
  fixture.questionnaireService.saveResponse({
    workItemId: fixture.workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse)),
    revision: pkg.session.revision,
    actorUserId: "m7-test-operator",
    markReadyForReview: true
  });
}

function assertOutcome(error, statusCode, code) {
  assert.ok(error instanceof OperationOutcomeError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.outcome.issue[0].code, code);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function withTestServer(store, callback) {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const server = createServer({ repository, store });
  await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolveServer, reject) => {
      server.close((error) => error ? reject(error) : resolveServer());
    });
  }
}

test("evidence fixtures expose inline, binary, and bundle-like DocumentReference modes", () => {
  const fixture = createFixture();
  try {
    const inline = fixture.evidenceRepository.attachFixture(fixture.workItem.id, { fixtureId: "fixture-pt-summary-inline" });
    const binary = fixture.evidenceRepository.attachFixture(fixture.workItem.id, { fixtureId: "fixture-mri-note-binary" });
    const bundle = fixture.evidenceRepository.attachFixture(fixture.workItem.id, { fixtureId: "fixture-bundle-smoke" });

    assert.equal(inline.documentReference.content[0].attachment.data, inline.inlineBase64);
    assert.equal(binary.documentReference.content[0].attachment.url, `Binary/${binary.binary.id}`);
    assert.match(bundle.documentReference.content[0].attachment.url, /^Bundle\//);
  } finally {
    cleanup(fixture);
  }
});

test("upload validation rejects unsupported MIME, oversized payload, malformed base64, missing filename, and checksum mismatch", () => {
  const fixture = createFixture();
  try {
    const goodBase64 = Buffer.from("hello").toString("base64");
    assert.throws(
      () => fixture.evidenceRepository.uploadEvidence(fixture.workItem.id, { filename: "x.exe", contentType: "application/x-msdownload", base64Data: goodBase64 }),
      (error) => {
        assertOutcome(error, 400, "invalid");
        return true;
      }
    );
    assert.throws(
      () => fixture.evidenceRepository.uploadEvidence(fixture.workItem.id, { filename: "large.txt", contentType: "text/plain", base64Data: Buffer.alloc(512 * 1024 + 1).toString("base64") }),
      (error) => {
        assertOutcome(error, 413, "too-costly");
        return true;
      }
    );
    assert.throws(
      () => fixture.evidenceRepository.uploadEvidence(fixture.workItem.id, { filename: "bad.txt", contentType: "text/plain", base64Data: "not base64*" }),
      (error) => {
        assertOutcome(error, 400, "invalid");
        return true;
      }
    );
    assert.throws(
      () => fixture.evidenceRepository.uploadEvidence(fixture.workItem.id, { filename: "", contentType: "text/plain", base64Data: goodBase64 }),
      (error) => {
        assertOutcome(error, 400, "required");
        return true;
      }
    );
    assert.throws(
      () => fixture.evidenceRepository.uploadEvidence(fixture.workItem.id, { filename: "bad-checksum.txt", contentType: "text/plain", base64Data: goodBase64, sha256: "nope" }),
      (error) => {
        assertOutcome(error, 400, "invalid");
        return true;
      }
    );
  } finally {
    cleanup(fixture);
  }
});

test("accepted evidence changes packet IDs and stable evidence keeps packet IDs deterministic", () => {
  const first = createFixture();
  const second = createFixture();
  const third = createFixture();
  try {
    markReady(first);
    markReady(second);
    markReady(third);
    const firstEvidence = first.evidenceRepository.attachFixture(first.workItem.id, { fixtureId: "fixture-mri-note-binary" });
    first.evidenceRepository.acceptEvidence(first.workItem.id, firstEvidence.id, "m7-test-operator");
    const secondEvidence = second.evidenceRepository.attachFixture(second.workItem.id, { fixtureId: "fixture-mri-note-binary" });
    second.evidenceRepository.acceptEvidence(second.workItem.id, secondEvidence.id, "m7-test-operator");
    const thirdEvidence = third.evidenceRepository.attachFixture(third.workItem.id, { fixtureId: "fixture-pt-summary-inline" });
    third.evidenceRepository.acceptEvidence(third.workItem.id, thirdEvidence.id, "m7-test-operator");

    const firstPacket = first.submissionService.buildPacket({ workItemId: first.workItem.id, actorUserId: "m7-test-operator" });
    const firstAgain = first.submissionService.buildPacket({ workItemId: first.workItem.id, actorUserId: "m7-test-operator" });
    const secondPacket = second.submissionService.buildPacket({ workItemId: second.workItem.id, actorUserId: "m7-test-operator" });
    const thirdPacket = third.submissionService.buildPacket({ workItemId: third.workItem.id, actorUserId: "m7-test-operator" });

    assert.equal(firstPacket.id, firstAgain.id);
    assert.equal(firstPacket.id, secondPacket.id);
    assert.notEqual(firstPacket.id, thirdPacket.id);
    assert.equal(firstPacket.attachmentManifest.attachments.length, 1);
    assert.ok(firstPacket.bundle.entry.some((entry) => entry.resource.resourceType === "DocumentReference"));
    assert.ok(firstPacket.bundle.entry.some((entry) => entry.resource.resourceType === "Binary"));
  } finally {
    cleanup(first);
    cleanup(second);
    cleanup(third);
  }
});

test("upload metadata uses a local referenced location and audit records evidence lifecycle", () => {
  const fixture = createFixture();
  try {
    const body = Buffer.from("Synthetic upload");
    const uploaded = fixture.evidenceRepository.uploadEvidence(fixture.workItem.id, {
      filename: "uploaded_note.txt",
      contentType: "text/plain",
      base64Data: body.toString("base64"),
      sha256: sha256(body),
      actorUserId: "m7-test-operator"
    });
    const accepted = fixture.evidenceRepository.acceptEvidence(fixture.workItem.id, uploaded.id, "m7-test-operator");
    markReady(fixture);
    const packet = fixture.submissionService.buildPacket({ workItemId: fixture.workItem.id, actorUserId: "m7-test-operator" });
    const events = fixture.store.getAuditEventsForWorkItem(fixture.workItem.id).map((event) => event.action);

    assert.equal(uploaded.contentMode, "local-reference");
    assert.match(uploaded.documentReference.content[0].attachment.url, /^local-upload:\/\//);
    assert.equal(accepted.status, "accepted");
    assert.equal(packet.attachmentManifest.attachments[0].evidenceAttachmentId, uploaded.id);
    assert.ok(events.includes("evidence.uploaded"));
    assert.ok(events.includes("evidence.accepted"));
    assert.ok(events.includes("evidence.included_in_packet"));
  } finally {
    cleanup(fixture);
  }
});

test("remove evidence records audit and excludes it from packet manifest", () => {
  const fixture = createFixture();
  try {
    const attached = fixture.evidenceRepository.attachFixture(fixture.workItem.id, { fixtureId: "fixture-pt-summary-inline" });
    fixture.evidenceRepository.removeEvidence(fixture.workItem.id, attached.id, "m7-test-operator");
    markReady(fixture);
    const packet = fixture.submissionService.buildPacket({ workItemId: fixture.workItem.id, actorUserId: "m7-test-operator" });
    const events = fixture.store.getAuditEventsForWorkItem(fixture.workItem.id).map((event) => event.action);

    assert.equal(packet.attachmentManifest.attachments.length, 0);
    assert.ok(events.includes("evidence.attached"));
    assert.ok(events.includes("evidence.removed"));
  } finally {
    cleanup(fixture);
  }
});

test("standards-shaped aliases return explicit non-conformance metadata", async () => {
  const fixture = createFixture();
  try {
    await withTestServer(fixture.store, async (baseUrl) => {
      const boundaries = await (await fetch(`${baseUrl}/standards/boundaries`)).json();
      const crd = await (await fetch(`${baseUrl}/crd/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(goldenScenario.request)
      })).json();
      const dtr = await (await fetch(`${baseUrl}/dtr/questionnaire-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workItemId: fixture.workItem.id })
      })).json();

      assert.equal(boundaries.conformance, false);
      assert.ok(boundaries.boundaries.every((boundary) => boundary.conformance === false));
      assert.equal(crd.conformance, false);
      assert.equal(dtr.conformance, false);
      assert.equal(dtr.response.resourceType, "Parameters");
    });
  } finally {
    cleanup(fixture);
  }
});
