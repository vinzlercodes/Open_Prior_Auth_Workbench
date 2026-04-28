import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateRequirement } from "../apps/api/dist/evaluation/evaluate.js";
import { OperationOutcomeError } from "../apps/api/dist/errors.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { QuestionnaireService } from "../apps/api/dist/questionnaires/questionnaireService.js";
import { createServer } from "../apps/api/dist/server.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";
import { SubmissionService } from "../apps/api/dist/submissions/submissionService.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

function createFixture() {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const result = store.saveEvaluation(
    goldenScenario.request,
    evaluateRequirement(goldenScenario.request, repository)
  );
  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "m3-test-operator"
  });
  const questionnaireService = new QuestionnaireService(repository, store);
  const submissionService = new SubmissionService(repository, store);

  return { questionnaireService, store, submissionService, workItem };
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

function markReady(questionnaireService, workItem) {
  const pkg = questionnaireService.getPackage(workItem.id);
  return questionnaireService.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse)),
    revision: pkg.session.revision,
    actorUserId: "m3-test-operator",
    markReadyForReview: true
  });
}

function assertOutcome(error, statusCode, code) {
  assert.ok(error instanceof OperationOutcomeError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.outcome.resourceType, "OperationOutcome");
  assert.equal(error.outcome.issue[0].code, code);
}

function findResource(bundle, resourceType) {
  return bundle.entry.find((entry) => entry.resource.resourceType === resourceType)?.resource;
}

function auditActions(events, action) {
  return events.filter((event) => event.action === action);
}

async function withTestServer(store, callback) {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const server = createServer({ repository, store });

  await new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", resolveServer);
  });

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

test("building a PAS-style local packet requires a review-ready work item", () => {
  const { submissionService, workItem } = createFixture();

  assert.throws(
    () => submissionService.buildPacket({
      workItemId: workItem.id,
      actorUserId: "m3-test-operator"
    }),
    (error) => {
      assertOutcome(error, 409, "conflict");
      return true;
    }
  );
});

test("golden case builds a deterministic PAS-style local packet with a preauthorization Claim", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  const ready = markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const rebuilt = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const claim = findResource(packet.bundle, "Claim");

  assert.equal(packet.id, rebuilt.id);
  assert.equal(packet.transport, "mock-pas");
  assert.equal(packet.packetSchemaVersion, "m7.local-pas-evidence.v1");
  assert.equal(packet.snapshot.workItemId, workItem.id);
  assert.equal(packet.snapshot.questionnaireResponseId, ready.questionnaireResponse.id);
  assert.equal(packet.snapshot.questionnaireResponseRevision, ready.session.revision);
  assert.equal(packet.snapshot.payerId, workItem.payerId);
  assert.equal(packet.attachmentManifest.attachments.length, 0);
  assert.equal(packet.attachmentManifest.missingFixtureReason, "No accepted evidence attachments");
  assert.ok(packet.snapshot.evidenceDigest);
  assert.equal(claim.use, "preauthorization");
  assert.equal(findResource(packet.bundle, "QuestionnaireResponse").id, ready.questionnaireResponse.id);
  assert.equal(store.getWorkItem(workItem.id).status, "packet_ready");
});

test("mock PAS submission returns a ClaimResponse-like response Bundle and is idempotent", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const receipt = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const again = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const claimResponse = findResource(receipt.responseBundle, "ClaimResponse");

  assert.equal(receipt.packetId, packet.id);
  assert.equal(receipt.transport, "mock-pas");
  assert.equal(receipt.idempotent, false);
  assert.equal(claimResponse.use, "preauthorization");
  assert.equal(claimResponse.preAuthRef, receipt.trackingId);
  assert.equal(receipt.responseBundle.entry.length, 1);
  assert.equal(again.receiptId, receipt.receiptId);
  assert.equal(again.idempotent, true);
  assert.equal(store.getWorkItem(workItem.id).status, "submitted");
});

test("status timeline records review-ready to packet-ready to submitted transitions", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const receipt = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const events = store.getStatusEvents(workItem.id);
  const transitions = events.map((event) => `${event.fromStatus ?? "none"}->${event.toStatus}`);
  const packetReady = events.find((event) => event.toStatus === "packet_ready");
  const submitted = events.find((event) => event.toStatus === "submitted");

  assert.ok(transitions.includes("review_ready->packet_ready"));
  assert.ok(transitions.includes("packet_ready->submitted"));
  assert.ok(packetReady.eventId);
  assert.equal(packetReady.workItemId, workItem.id);
  assert.equal(packetReady.actor, "m3-test-operator");
  assert.equal(packetReady.packetId, packet.id);
  assert.equal(packetReady.causedBy, "submission_packet.built");
  assert.ok(packetReady.at);
  assert.equal(submitted.receiptId, receipt.receiptId);
  assert.equal(submitted.packetId, packet.id);
});

test("submit rejects a stale packet after the QuestionnaireResponse revision changes", () => {
  const { questionnaireService, submissionService, workItem } = createFixture();
  const ready = markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const editedResponse = clone(ready.questionnaireResponse);
  setAnswer(editedResponse, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: "urgent",
      display: "Urgent"
    }
  });
  questionnaireService.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: editedResponse,
    revision: ready.session.revision,
    actorUserId: "m3-test-operator",
    markReadyForReview: true
  });

  assert.throws(
    () => submissionService.submitPacket({
      packetId: packet.id,
      actorUserId: "m3-test-operator"
    }),
    (error) => {
      assertOutcome(error, 409, "conflict");
      assert.match(error.message, /stale/);
      return true;
    }
  );
});

test("audit trail returns sequence-ordered full snapshots for M3 lifecycle changes", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const receipt = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const events = store.getAuditEventsForWorkItem(workItem.id);
  const sequences = events.map((event) => event.sequence);
  const created = events.find((event) => event.action === "work_item.created");
  const reviewReady = events.find((event) =>
    event.action === "work_item.status_updated"
    && event.beforeJson.status === "questionnaire_in_progress"
    && event.afterJson.status === "review_ready"
  );
  const packetReady = events.find((event) => event.action === "submission_packet.built");
  const submitted = events.find((event) => event.action === "submission_packet.submitted");

  assert.deepEqual(sequences, [...sequences].sort((first, second) => first - second));
  assert.ok(events.every((event) => event.eventId.startsWith("ae-")));
  assert.ok(events.every((event) => event.workItemId === workItem.id));
  assert.ok(created);
  assert.ok(reviewReady);
  assert.ok(packetReady);
  assert.ok(submitted);
  assert.equal(created.beforeJson, null);
  assert.equal(created.afterJson.id, workItem.id);
  assert.equal(created.afterJson.status, "requirements_found");
  assert.equal(reviewReady.beforeJson.id, workItem.id);
  assert.equal(reviewReady.afterJson.id, workItem.id);
  assert.equal(reviewReady.beforeJson.status, "questionnaire_in_progress");
  assert.equal(reviewReady.afterJson.status, "review_ready");
  assert.equal(packetReady.beforeJson.status, "review_ready");
  assert.equal(packetReady.afterJson.status, "packet_ready");
  assert.equal(packetReady.packetId, packet.id);
  assert.equal(submitted.beforeJson.status, "packet_ready");
  assert.equal(submitted.afterJson.status, "submitted");
  assert.equal(submitted.packetId, packet.id);
  assert.equal(submitted.receiptId, receipt.receiptId);
});

test("work-item audit includes linked questionnaire, packet, and receipt resources", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const receipt = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const events = store.getAuditEventsForWorkItem(workItem.id);
  const resourceTypes = new Set(events.map((event) => event.resourceType));

  assert.ok(resourceTypes.has("WorkItem"));
  assert.ok(resourceTypes.has("QuestionnaireSession"));
  assert.ok(resourceTypes.has("SubmissionPacket"));
  assert.ok(resourceTypes.has("SubmissionReceipt"));
  assert.ok(events.every((event) => event.workItemId === workItem.id));
  assert.ok(events.some((event) => event.resourceType === "QuestionnaireSession" && event.resourceId !== workItem.id));
  assert.ok(events.some((event) => event.resourceType === "SubmissionPacket" && event.resourceId === packet.id));
  assert.ok(events.some((event) => event.resourceType === "SubmissionReceipt" && event.resourceId === receipt.receiptId));
});

test("idempotent packet rebuild and receipt re-submit do not create duplicate saved audit events", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const receipt = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const events = store.getAuditEventsForWorkItem(workItem.id);

  assert.equal(auditActions(events, "submission_packet.saved").length, 1);
  assert.equal(auditActions(events, "submission_receipt.saved").length, 1);
  assert.equal(auditActions(events, "submission_packet.submitted").length, 1);
  assert.equal(receipt.idempotent, false);
});

test("work-item audit endpoint returns linked audit events and 404 for unknown work items", async () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });

  await withTestServer(store, async (baseUrl) => {
    const response = await fetch(`${baseUrl}/work-items/${workItem.id}/audit`);
    const events = await response.json();
    const missing = await fetch(`${baseUrl}/work-items/missing/audit`);

    assert.equal(response.status, 200);
    assert.ok(events.some((event) => event.resourceType === "QuestionnaireSession" && event.resourceId !== workItem.id));
    assert.ok(events.some((event) => event.resourceType === "SubmissionPacket" && event.resourceId === packet.id));
    assert.equal(missing.status, 404);
  });
});
