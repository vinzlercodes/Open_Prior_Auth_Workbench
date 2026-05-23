import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  buildSubmissionPacket,
  evaluateRequirements,
  getCaseAuditTrace,
  getCaseStatusTimeline,
  getPriorAuthorizationCase,
  getQuestionnairePackage,
  listEvidence,
  listWorkItems,
  OperationsService,
  saveQuestionnaireResponse,
  submitMockPacket
} from "../packages/prior-auth-core/dist/index.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

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

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

test("prior-auth-core source does not import app adapters or ToolNet", () => {
  const files = sourceFiles(resolve(process.cwd(), "packages/prior-auth-core/src")).filter((path) => path.endsWith(".ts"));
  const source = files.map((path) => readFileSync(path, "utf8")).join("\n");

  assert.ok(!source.includes("apps/api"));
  assert.ok(!source.includes("../apps"));
  assert.ok(!source.includes("doctor-toolnet"));
});

test("M1a use cases expose prior auth case root over existing API adapters", () => {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const result = evaluateRequirements(goldenScenario.request, repository, store);
  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "m1a-core-test"
  });
  const rows = listWorkItems(store, { owner: "m1a-core-test" });
  const evidence = listEvidence(workItem.id, store);
  const pkg = getQuestionnairePackage({ workItemId: workItem.id }, repository, store);
  const ready = saveQuestionnaireResponse({
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse)),
    revision: pkg.session.revision,
    actorUserId: "m1a-core-test",
    markReadyForReview: true
  }, repository, store);
  const packet = buildSubmissionPacket({ workItemId: workItem.id, actorUserId: "m1a-core-test" }, repository, store);
  const receipt = submitMockPacket({ packetId: packet.id, actorUserId: "m1a-core-test" }, repository, store);

  new OperationsService(store).recordPayerStatus(workItem.id, {
    status: "approved",
    actor: "mock-payer",
    message: "Approved by mock payer."
  });

  const priorAuthCase = getPriorAuthorizationCase(workItem.id, store);
  const timeline = getCaseStatusTimeline(workItem.id, store);
  const auditTrace = getCaseAuditTrace(workItem.id, store);

  assert.equal(rows[0].workItemId, workItem.id);
  assert.equal(evidence.workItemId, workItem.id);
  assert.equal(ready.questionnaireResponse.status, "completed");
  assert.equal(priorAuthCase.id, workItem.id);
  assert.equal(priorAuthCase.lifecycleStatus, "approved");
  assert.equal(priorAuthCase.workItem.id, workItem.id);
  assert.equal(priorAuthCase.currentRequest.id, `par-${workItem.id}`);
  assert.equal(priorAuthCase.currentRequest.requestStatus, "closed");
  assert.equal(priorAuthCase.currentRequest.latestSubmissionPacketId, packet.id);
  assert.equal(priorAuthCase.currentRequest.latestReceiptId, receipt.receiptId);
  assert.equal(priorAuthCase.currentRequest.trackingId, receipt.trackingId);
  assert.equal(priorAuthCase.submissionPackets[0].id, packet.id);
  assert.equal(priorAuthCase.submissionReceipts[0].receiptId, receipt.receiptId);
  assert.equal(priorAuthCase.payerUpdates[0].status, "approved");
  assert.equal(priorAuthCase.payerDetermination.status, "approved");
  assert.ok(timeline.some((event) => event.toStatus === "approved"));
  assert.ok(auditTrace.some((event) => event.action === "payer_status.approved"));
});
