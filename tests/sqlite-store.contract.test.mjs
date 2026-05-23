import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { evaluateRequirement } from "../packages/prior-auth-core/dist/index.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { OperationsService } from "../packages/prior-auth-core/dist/index.js";
import { QuestionnaireService } from "../packages/prior-auth-core/dist/index.js";
import { SqliteStore } from "../apps/api/dist/storage/sqliteStore.js";
import { SubmissionService } from "../packages/prior-auth-core/dist/index.js";

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

test("SQLite migration v1 to v2 preserves older M6 packets without evidence manifests", () => withTempDb((path) => {
  createM6DatabaseFixture(path);
  const store = new SqliteStore(path, () => new Date("2026-04-25T12:00:00.000Z"));
  const packet = store.getSubmissionPacket("packet-m6-fixture");
  const receipt = store.getSubmissionReceiptByPacketId("packet-m6-fixture");
  const migrations = new DatabaseSync(path, { readBigInts: false, returnArrays: false });
  const version = migrations.prepare("SELECT MAX(version) AS version FROM schema_migrations").get().version;
  const evidenceTables = migrations.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'evidence_attachments'").all();

  assert.equal(version, 2);
  assert.equal(evidenceTables.length, 1);
  assert.equal(packet.id, "packet-m6-fixture");
  assert.equal(packet.packetSchemaVersion, "m3.local-pas-style.v1");
  assert.equal(packet.attachmentManifest.attachments.length, 0);
  assert.equal(packet.attachmentManifest.missingFixtureReason, "No document fixtures in M3");
  assert.equal(receipt.receiptId, "receipt-m6-fixture");
  migrations.close();
  store.close();
}));

function createM6DatabaseFixture(path) {
  const db = new DatabaseSync(path, {
    enableForeignKeyConstraints: true,
    readBigInts: false,
    returnArrays: false
  });
  const request = goldenScenario.request;
  const result = {
    ...goldenScenario.expected,
    determinism: "deterministic",
    requestSummary: {
      patientName: "Elena Rivera",
      serviceDescription: "MRI lumbar spine without contrast",
      payerName: "Acme Health Plan"
    },
    questionnaireCanonicals: ["http://openpriorauth.local/fhir/Questionnaire/mri-lumbar-spine-prior-auth|2026.04"],
    missingData: [],
    explanatoryNotes: []
  };
  const snapshot = {
    workItemId: "wi-m6-fixture",
    questionnaireResponseId: "qr-m6-fixture",
    questionnaireResponseRevision: 1,
    payerId: "acme-health",
    packetSchemaVersion: "m3.local-pas-style.v1"
  };
  db.exec(`
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL CHECK (length(applied_at) > 0)
    ) STRICT;
    INSERT INTO schema_migrations (version, applied_at) VALUES (1, '2026-04-25T12:00:00.000Z');

    CREATE TABLE requirement_runs (
      evaluation_id TEXT PRIMARY KEY NOT NULL,
      request_json TEXT NOT NULL CHECK (json_valid(request_json)),
      result_json TEXT NOT NULL CHECK (json_valid(result_json)),
      created_at TEXT NOT NULL CHECK (length(created_at) > 0)
    ) STRICT;

    CREATE TABLE work_items (
      id TEXT PRIMARY KEY NOT NULL,
      evaluation_id TEXT NOT NULL UNIQUE REFERENCES requirement_runs(evaluation_id) ON DELETE RESTRICT,
      patient_id TEXT NOT NULL,
      coverage_id TEXT NOT NULL,
      request_resource_type TEXT NOT NULL CHECK (request_resource_type IN ('ServiceRequest','MedicationRequest','DeviceRequest')),
      request_resource_id TEXT NOT NULL,
      service_line TEXT NOT NULL,
      payer_id TEXT NOT NULL,
      owner_user_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL CHECK (length(created_at) > 0),
      requirement_result_json TEXT NOT NULL CHECK (json_valid(requirement_result_json))
    ) STRICT;

    CREATE TABLE submission_packets (
      id TEXT PRIMARY KEY NOT NULL,
      work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      packet_schema_version TEXT NOT NULL CHECK (packet_schema_version = 'm3.local-pas-style.v1'),
      built_at TEXT NOT NULL,
      transport TEXT NOT NULL CHECK (transport = 'mock-pas'),
      bundle_json TEXT NOT NULL CHECK (json_valid(bundle_json)),
      attachment_manifest_json TEXT NOT NULL CHECK (json_valid(attachment_manifest_json)),
      snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
      snapshot_work_item_id TEXT NOT NULL,
      snapshot_questionnaire_response_id TEXT NOT NULL,
      snapshot_questionnaire_response_revision INTEGER NOT NULL CHECK (snapshot_questionnaire_response_revision >= 1),
      snapshot_payer_id TEXT NOT NULL,
      UNIQUE (
        snapshot_work_item_id,
        snapshot_questionnaire_response_id,
        snapshot_questionnaire_response_revision,
        snapshot_payer_id,
        packet_schema_version
      )
    ) STRICT;

    CREATE TABLE operation_events (
      id TEXT PRIMARY KEY NOT NULL,
      work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('payer_status_recorded','more_info_requested','more_info_resolved','case_assigned','case_cancelled')),
      actor TEXT NOT NULL CHECK (actor IN ('user','mock-payer','system')),
      created_at TEXT NOT NULL,
      details_json TEXT NOT NULL CHECK (json_valid(details_json))
    ) STRICT;

    CREATE TABLE submission_receipts (
      receipt_id TEXT PRIMARY KEY NOT NULL,
      packet_id TEXT NOT NULL UNIQUE REFERENCES submission_packets(id) ON DELETE CASCADE,
      tracking_id TEXT NOT NULL,
      submitted_at TEXT NOT NULL,
      transport TEXT NOT NULL CHECK (transport = 'mock-pas'),
      idempotent INTEGER NOT NULL CHECK (idempotent IN (0, 1)),
      response_bundle_json TEXT NOT NULL CHECK (json_valid(response_bundle_json))
    ) STRICT;
  `);
  db.prepare("INSERT INTO requirement_runs (evaluation_id, request_json, result_json, created_at) VALUES (?, ?, ?, ?)")
    .run("eval-m6-fixture", JSON.stringify(request), JSON.stringify(result), "2026-04-25T12:00:00.000Z");
  db.prepare(`
    INSERT INTO work_items (
      id, evaluation_id, patient_id, coverage_id, request_resource_type, request_resource_id,
      service_line, payer_id, owner_user_id, status, created_at, requirement_result_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "wi-m6-fixture",
    "eval-m6-fixture",
    request.patientId,
    request.coverageId,
    request.requestResourceType,
    request.requestResourceId,
    request.serviceLine,
    request.payerId,
    "m6-test-operator",
    "packet_ready",
    "2026-04-25T12:00:00.000Z",
    JSON.stringify(result)
  );
  db.prepare(`
    INSERT INTO submission_packets (
      id, work_item_id, packet_schema_version, built_at, transport, bundle_json,
      attachment_manifest_json, snapshot_json, snapshot_work_item_id,
      snapshot_questionnaire_response_id, snapshot_questionnaire_response_revision, snapshot_payer_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    "packet-m6-fixture",
    "wi-m6-fixture",
    "m3.local-pas-style.v1",
    "2026-04-25T12:00:00.000Z",
    "mock-pas",
    JSON.stringify({ resourceType: "Bundle", id: "bundle-m6-fixture", type: "collection", entry: [] }),
    JSON.stringify({ attachments: [], missingFixtureReason: "No document fixtures in M3" }),
    JSON.stringify(snapshot),
    snapshot.workItemId,
    snapshot.questionnaireResponseId,
    snapshot.questionnaireResponseRevision,
    snapshot.payerId
  );
  db.prepare(`
    INSERT INTO submission_receipts (
      receipt_id, packet_id, tracking_id, submitted_at, transport, idempotent, response_bundle_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    "receipt-m6-fixture",
    "packet-m6-fixture",
    "mock-pas-m6-fixture",
    "2026-04-25T12:01:00.000Z",
    "mock-pas",
    0,
    JSON.stringify({ resourceType: "Bundle", id: "bundle-receipt-m6-fixture", type: "collection", entry: [] })
  );
  db.close();
}
