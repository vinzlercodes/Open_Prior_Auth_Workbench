import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { evaluateRequirement } from "../apps/api/dist/evaluation/evaluate.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { OperationsService } from "../apps/api/dist/operations/operationsService.js";
import { QuestionnaireService } from "../apps/api/dist/questionnaires/questionnaireService.js";
import { SqliteStore } from "../apps/api/dist/storage/sqliteStore.js";
import { SubmissionService } from "../apps/api/dist/submissions/submissionService.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

function withTempDb(callback) {
  const directory = mkdtempSync(join(tmpdir(), "opa-sqlite-"));
  const path = join(directory, "test.sqlite");
  try {
    return callback(path);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

function createClock(start = "2026-04-25T12:00:00.000Z") {
  let now = new Date(start);
  return {
    clock: () => now,
    setNow: (value) => {
      now = new Date(value);
    }
  };
}

function createFixture(path, clock = () => new Date("2026-04-25T12:00:00.000Z")) {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new SqliteStore(path, clock);
  const questionnaireService = new QuestionnaireService(repository, store);
  const submissionService = new SubmissionService(repository, store);
  const operationsService = new OperationsService(store);
  const result = store.saveEvaluation(
    goldenScenario.request,
    evaluateRequirement(goldenScenario.request, repository)
  );
  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "sqlite-test-operator"
  });

  return { operationsService, questionnaireService, repository, store, submissionService, workItem };
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

function submitCase(fixture) {
  const pkg = fixture.questionnaireService.getPackage(fixture.workItem.id);
  fixture.questionnaireService.saveResponse({
    workItemId: fixture.workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse)),
    revision: pkg.session.revision,
    actorUserId: "sqlite-test-operator",
    markReadyForReview: true
  });
  const packet = fixture.submissionService.buildPacket({
    workItemId: fixture.workItem.id,
    actorUserId: "sqlite-test-operator"
  });
  const receipt = fixture.submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "sqlite-test-operator"
  });
  return { packet, receipt };
}

test("SQLite store persists the M1-M5 case lifecycle across restart", () => withTempDb((path) => {
  const time = createClock();
  const fixture = createFixture(path, time.clock);
  const { packet, receipt } = submitCase(fixture);
  fixture.operationsService.recordPayerStatus(fixture.workItem.id, {
    status: "pended",
    actor: "mock-payer",
    message: "Pending nurse review."
  });
  const auditBeforeRestart = fixture.store.getAuditEventsForWorkItem(fixture.workItem.id);
  fixture.store.close();

  const reopenedStore = new SqliteStore(path, time.clock);
  const reopenedOperations = new OperationsService(reopenedStore);
  const workItem = reopenedStore.getWorkItem(fixture.workItem.id);
  const row = reopenedOperations.listQueue({ status: "pended" })[0];
  const statusEvents = reopenedStore.getStatusEvents(fixture.workItem.id);
  const auditEvents = reopenedStore.getAuditEventsForWorkItem(fixture.workItem.id);
  const packets = reopenedStore.getSubmissionPacketsForWorkItem(fixture.workItem.id);
  const receipts = reopenedStore.getSubmissionReceiptsForWorkItem(fixture.workItem.id);
  const history = reopenedOperations.getOperationsHistory(fixture.workItem.id);

  assert.equal(workItem.status, "submitted");
  assert.equal(row.effectiveStatus, "pended");
  assert.ok(statusEvents.some((event) => event.toStatus === "submitted"));
  assert.deepEqual(auditEvents.map((event) => event.sequence), auditBeforeRestart.map((event) => event.sequence));
  assert.equal(packets[0].id, packet.id);
  assert.equal(receipts[0].receiptId, receipt.receiptId);
  assert.equal(history.payerUpdates[0].status, "pended");
  reopenedStore.close();
}));

test("SQLite transaction rolls back multi-table payer status and audit writes atomically", () => withTempDb((path) => {
  const time = createClock();
  const fixture = createFixture(path, time.clock);
  const { receipt } = submitCase(fixture);
  const beforeAuditCount = fixture.store.getAuditEventsForWorkItem(fixture.workItem.id).length;
  const beforeStatusCount = fixture.store.getStatusEvents(fixture.workItem.id).length;

  assert.throws(
    () => fixture.store.transaction(() => {
      const update = fixture.store.savePayerUpdate({
        workItemId: fixture.workItem.id,
        status: "approved",
        actor: "mock-payer",
        createdAt: "2026-04-25T12:01:00.000Z",
        submittedAt: receipt.submittedAt,
        decidedAt: "2026-04-25T12:01:00.000Z",
        decisionTimeMs: 60_000,
        message: "Approved in a transaction that will fail."
      });
      fixture.store.recordOperationEvent(fixture.workItem.id, "payer_status_recorded", "mock-payer", update);
      fixture.store.updateWorkItemStatus(fixture.workItem.id, "approved", "mock-payer", "payer_status.approved");
      throw new Error("force rollback");
    }),
    /force rollback/
  );

  assert.equal(fixture.store.getWorkItem(fixture.workItem.id).status, "submitted");
  assert.equal(fixture.store.getPayerUpdatesForWorkItem(fixture.workItem.id).length, 0);
  assert.equal(fixture.store.getOperationEventsForWorkItem(fixture.workItem.id).length, 0);
  assert.equal(fixture.store.getStatusEvents(fixture.workItem.id).length, beforeStatusCount);
  assert.equal(fixture.store.getAuditEventsForWorkItem(fixture.workItem.id).length, beforeAuditCount);
  fixture.store.close();
}));

test("SQLite constraints preserve packet and receipt idempotency", () => withTempDb((path) => {
  const fixture = createFixture(path);
  const pkg = fixture.questionnaireService.getPackage(fixture.workItem.id);
  fixture.questionnaireService.saveResponse({
    workItemId: fixture.workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse)),
    revision: pkg.session.revision,
    actorUserId: "sqlite-test-operator",
    markReadyForReview: true
  });
  const packet = fixture.submissionService.buildPacket({
    workItemId: fixture.workItem.id,
    actorUserId: "sqlite-test-operator"
  });
  const rebuilt = fixture.submissionService.buildPacket({
    workItemId: fixture.workItem.id,
    actorUserId: "sqlite-test-operator"
  });
  const receipt = fixture.submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "sqlite-test-operator"
  });
  const resubmitted = fixture.submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "sqlite-test-operator"
  });

  assert.equal(rebuilt.id, packet.id);
  assert.equal(fixture.store.getSubmissionPacketsForWorkItem(fixture.workItem.id).length, 1);
  assert.equal(resubmitted.receiptId, receipt.receiptId);
  assert.equal(resubmitted.idempotent, true);
  assert.equal(fixture.store.getSubmissionReceiptsForWorkItem(fixture.workItem.id).length, 1);
  fixture.store.close();
}));
