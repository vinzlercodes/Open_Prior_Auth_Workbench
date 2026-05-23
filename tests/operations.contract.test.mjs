import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateRequirement } from "../packages/prior-auth-core/dist/index.js";
import { OperationOutcomeError } from "../packages/prior-auth-core/dist/index.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { OperationsService } from "../packages/prior-auth-core/dist/index.js";
import { QuestionnaireService } from "../packages/prior-auth-core/dist/index.js";
import { createServer } from "../apps/api/dist/server.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";
import { SubmissionService } from "../packages/prior-auth-core/dist/index.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

const allStatuses = [
  "draft",
  "requirements_found",
  "not_required",
  "needs_baseline_data",
  "questionnaire_in_progress",
  "review_ready",
  "packet_ready",
  "submitted",
  "more_info_needed",
  "approved",
  "denied",
  "cancelled",
  "submission_failed"
];

const allowedTransitions = {
  draft: ["requirements_found", "needs_baseline_data", "not_required", "questionnaire_in_progress", "cancelled"],
  requirements_found: ["questionnaire_in_progress", "cancelled"],
  not_required: [],
  needs_baseline_data: ["questionnaire_in_progress", "cancelled"],
  questionnaire_in_progress: ["review_ready", "cancelled"],
  review_ready: ["packet_ready", "questionnaire_in_progress", "cancelled"],
  packet_ready: ["submitted", "submission_failed", "cancelled"],
  submitted: ["more_info_needed", "approved", "denied", "cancelled"],
  more_info_needed: ["review_ready", "cancelled"],
  approved: [],
  denied: [],
  cancelled: [],
  submission_failed: ["packet_ready", "cancelled"]
};

function createClock(start = "2026-04-25T12:00:00.000Z") {
  let now = new Date(start);
  return {
    clock: () => now,
    setNow: (value) => {
      now = new Date(value);
    },
    advance: (ms) => {
      now = new Date(now.getTime() + ms);
    }
  };
}

function createFixture(start) {
  const time = createClock(start);
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore(time.clock);
  const questionnaireService = new QuestionnaireService(repository, store);
  const submissionService = new SubmissionService(repository, store);
  const operationsService = new OperationsService(store);
  const result = evaluateRequirement(goldenScenario.request, repository);
  const workItem = createWorkItem(store, result, "m4-test-operator");

  return { ...time, operationsService, questionnaireService, repository, store, submissionService, workItem };
}

function createWorkItem(store, result, ownerUserId, suffix = "") {
  const saved = store.saveEvaluation(goldenScenario.request, {
    ...result,
    evaluationId: suffix ? `eval-${suffix}` : result.evaluationId
  });
  return store.createWorkItem({
    evaluationId: saved.evaluationId,
    ownerUserId
  });
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

function completeResponse(response, urgency = "routine") {
  setAnswer(response, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: urgency,
      display: urgency === "urgent" ? "Urgent" : "Routine"
    }
  });
  setAnswer(response, "prior-spine-surgery", { valueBoolean: false });
  return response;
}

function markReady(questionnaireService, workItem, urgency) {
  const pkg = questionnaireService.getPackage(workItem.id);
  return questionnaireService.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse), urgency),
    revision: pkg.session.revision,
    actorUserId: "m4-test-operator",
    markReadyForReview: true
  });
}

function submitCase(fixture, urgency = "routine") {
  markReady(fixture.questionnaireService, fixture.workItem, urgency);
  const packet = fixture.submissionService.buildPacket({
    workItemId: fixture.workItem.id,
    actorUserId: "m4-test-operator"
  });
  const receipt = fixture.submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m4-test-operator"
  });
  return { packet, receipt };
}

function assertOutcome(error, statusCode, code) {
  assert.ok(error instanceof OperationOutcomeError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.outcome.resourceType, "OperationOutcome");
  assert.equal(error.outcome.issue[0].code, code);
}

function minimalWorkItem(status, id = `wi-transition-${status}`) {
  return {
    id,
    evaluationId: `eval-transition-${status}`,
    patientId: "patient-mri-001",
    coverageId: "coverage-acme-001",
    requestResourceType: "ServiceRequest",
    requestResourceId: "servicerequest-mri-lumbar-001",
    serviceLine: "mri_lumbar_spine",
    payerId: "acme-health",
    ownerUserId: null,
    status,
    createdAt: "2026-04-25T12:00:00.000Z",
    requirementResult: {
      evaluationId: `eval-transition-${status}`,
      evaluationStatus: "requirements_found",
      requiresPriorAuth: true,
      requiresDocs: true,
      matchedRuleId: "mri-lspine-acme-001",
      rulePackVersion: "2026.04.23",
      nextAction: "create_work_item",
      determinism: "deterministic",
      requestSummary: {
        patientName: "Elena Rivera",
        payerName: "Acme Health Plan",
        serviceDescription: "MRI lumbar spine without contrast"
      },
      questionnaireCanonicals: ["http://openpriorauth.local/fhir/Questionnaire/mri-lumbar-spine-prior-auth|2026.04"],
      missingData: [],
      explanatoryNotes: []
    }
  };
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

test("queue effectiveStatus derives pended without mutating internal work item status", () => {
  const fixture = createFixture();
  submitCase(fixture);

  fixture.operationsService.recordPayerStatus(fixture.workItem.id, {
    status: "pended",
    actor: "mock-payer",
    message: "Pending nurse review."
  });
  const row = fixture.operationsService.listQueue({ status: "pended" })[0];

  assert.equal(row.effectiveStatus, "pended");
  assert.equal(row.status, "submitted");
  assert.equal(fixture.store.getWorkItem(fixture.workItem.id).status, "submitted");
});

test("queue filters owner and status, and stable-sorts ties by createdAt then workItemId", () => {
  const fixture = createFixture();
  const result = evaluateRequirement(goldenScenario.request, fixture.repository);
  const first = createWorkItem(fixture.store, result, null, "aaaaaaaaaaaa0000");
  const second = createWorkItem(fixture.store, result, "ops-user", "bbbbbbbbbbbb0000");
  const third = createWorkItem(fixture.store, result, null, "cccccccccccc0000");

  const unassigned = fixture.operationsService.listQueue({ owner: "unassigned", sort: "age_desc" });
  const ids = unassigned.map((row) => row.workItemId);

  assert.ok(ids.includes(first.id));
  assert.ok(!ids.includes(second.id));
  assert.ok(ids.includes(third.id));
  assert.deepEqual([...ids].sort(), ids);
  assert.equal(fixture.operationsService.listQueue({ status: "submitted" }).length, 0);
});

test("transition matrix accepts only declared internal workflow transitions", () => {
  for (const from of allStatuses) {
    for (const to of allStatuses) {
      if (from === to) {
        continue;
      }
      const clock = createClock();
      const store = new MemoryStore(clock.clock);
      const workItem = minimalWorkItem(from);
      store.workItems.set(workItem.id, workItem);
      const allowed = allowedTransitions[from].includes(to);

      if (allowed) {
        assert.doesNotThrow(() => store.updateWorkItemStatus(workItem.id, to, "matrix-test"));
      } else {
        assert.throws(
          () => store.updateWorkItemStatus(workItem.id, to, "matrix-test"),
          /Invalid work-item status transition/
        );
      }
    }
  }
});

test("payer decision timestamps drive deterministic CMS-style metrics", () => {
  const fixture = createFixture("2026-04-25T12:00:00.000Z");
  const { receipt } = submitCase(fixture);
  fixture.setNow("2026-04-25T12:00:10.000Z");
  const update = fixture.operationsService.recordPayerStatus(fixture.workItem.id, {
    status: "approved",
    actor: "mock-payer",
    message: "Approved by mock payer."
  });
  const metrics = fixture.operationsService.getMetrics();

  assert.equal(update.submittedAt, receipt.submittedAt);
  assert.equal(update.decidedAt, "2026-04-25T12:00:10.000Z");
  assert.equal(update.decisionTimeMs, 10_000);
  assert.equal(metrics.averageSubmissionToDecisionMs, 10_000);
  assert.equal(metrics.medianSubmissionToDecisionMs, 10_000);
  assert.equal(metrics.approvalRate, 1);
  assert.equal(metrics.denialRate, 0);
});

test("denials require structured denial reasons and become terminal", () => {
  const fixture = createFixture();
  submitCase(fixture);

  assert.throws(
    () => fixture.operationsService.recordPayerStatus(fixture.workItem.id, { status: "denied" }),
    (error) => {
      assertOutcome(error, 400, "required");
      return true;
    }
  );

  const update = fixture.operationsService.recordPayerStatus(fixture.workItem.id, {
    status: "denied",
    actor: "mock-payer",
    reason: {
      code: "insufficient-documentation",
      display: "Insufficient documentation",
      detail: "Conservative therapy duration was not documented."
    }
  });

  assert.equal(update.reason.source, "mock-payer");
  assert.equal(fixture.store.getWorkItem(fixture.workItem.id).status, "denied");
});

test("more-info loop resolves back to review-ready and revised evidence creates a new packet and receipt", () => {
  const fixture = createFixture();
  const first = submitCase(fixture);
  const again = fixture.submissionService.submitPacket({
    packetId: first.packet.id,
    actorUserId: "m4-test-operator"
  });

  assert.equal(again.receiptId, first.receipt.receiptId);
  assert.equal(again.idempotent, true);

  fixture.operationsService.requestMoreInfo(fixture.workItem.id, {
    message: "Please provide conservative therapy details.",
    requestedItems: [
      {
        code: "conservative-therapy-duration",
        label: "Duration of conservative therapy",
        required: true
      }
    ],
    dueAt: "2026-05-02T00:00:00.000Z"
  });
  const pkg = fixture.questionnaireService.getPackage(fixture.workItem.id);
  const edited = clone(pkg.questionnaireResponse);
  setAnswer(edited, "conservative-treatment-evidence", {
    valueString: "Patient completed eight weeks of supervised physical therapy and NSAIDs."
  });
  fixture.questionnaireService.saveResponse({
    workItemId: fixture.workItem.id,
    questionnaireResponse: edited,
    revision: pkg.session.revision,
    actorUserId: "m4-test-operator",
    markReadyForReview: true
  });

  assert.equal(fixture.store.getWorkItem(fixture.workItem.id).status, "review_ready");
  assert.ok(fixture.store.getMoreInfoRequestsForWorkItem(fixture.workItem.id)[0].resolvedAt);

  const secondPacket = fixture.submissionService.buildPacket({
    workItemId: fixture.workItem.id,
    actorUserId: "m4-test-operator"
  });
  const secondReceipt = fixture.submissionService.submitPacket({
    packetId: secondPacket.id,
    actorUserId: "m4-test-operator"
  });

  assert.notEqual(secondPacket.id, first.packet.id);
  assert.notEqual(secondReceipt.receiptId, first.receipt.receiptId);
});

test("stale packet submission rejects after QuestionnaireResponse revision changes", () => {
  const fixture = createFixture();
  markReady(fixture.questionnaireService, fixture.workItem);
  const packet = fixture.submissionService.buildPacket({
    workItemId: fixture.workItem.id,
    actorUserId: "m4-test-operator"
  });
  const pkg = fixture.questionnaireService.getPackage(fixture.workItem.id);
  const edited = clone(pkg.questionnaireResponse);
  setAnswer(edited, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: "urgent",
      display: "Urgent"
    }
  });
  fixture.questionnaireService.saveResponse({
    workItemId: fixture.workItem.id,
    questionnaireResponse: edited,
    revision: pkg.session.revision,
    actorUserId: "m4-test-operator",
    markReadyForReview: true
  });

  assert.throws(
    () => fixture.submissionService.submitPacket({
      packetId: packet.id,
      actorUserId: "m4-test-operator"
    }),
    (error) => {
      assertOutcome(error, 409, "conflict");
      assert.match(error.message, /stale/);
      return true;
    }
  );
});

test("terminal-state guards block more-info requests and payer updates", () => {
  const fixture = createFixture();
  submitCase(fixture);
  fixture.operationsService.recordPayerStatus(fixture.workItem.id, {
    status: "approved",
    actor: "mock-payer"
  });

  assert.throws(
    () => fixture.operationsService.requestMoreInfo(fixture.workItem.id, {
      message: "Need more details.",
      requestedItems: [{ code: "x", label: "X", required: true }]
    }),
    (error) => {
      assertOutcome(error, 409, "conflict");
      return true;
    }
  );
  assert.throws(
    () => fixture.operationsService.recordPayerStatus(fixture.workItem.id, {
      status: "cancelled",
      actor: "mock-payer"
    }),
    (error) => {
      assertOutcome(error, 409, "conflict");
      return true;
    }
  );
});

test("operations metrics handle empty and single-item states", () => {
  const empty = new OperationsService(new MemoryStore()).getMetrics();
  const fixture = createFixture();
  const single = fixture.operationsService.getMetrics();

  assert.equal(empty.totalWorkItems, 0);
  assert.equal(empty.averageSubmissionToDecisionMs, null);
  assert.equal(empty.approvalRate, 0);
  assert.equal(single.totalWorkItems, 1);
  assert.equal(single.submittedCount, 0);
  assert.equal(single.medianSubmissionToDecisionMs, null);
});

test("operations API returns queue, metrics, and per-work-item operations history", async () => {
  const fixture = createFixture();
  submitCase(fixture);
  fixture.operationsService.recordPayerStatus(fixture.workItem.id, {
    status: "pended",
    actor: "mock-payer"
  });

  await withTestServer(fixture.store, async (baseUrl) => {
    const queue = await fetch(`${baseUrl}/work-items?status=pended&sort=age_desc`);
    const metrics = await fetch(`${baseUrl}/operations/metrics`);
    const history = await fetch(`${baseUrl}/work-items/${fixture.workItem.id}/operations`);
    const missing = await fetch(`${baseUrl}/work-items/missing/operations`);

    assert.equal(queue.status, 200);
    assert.equal((await queue.json())[0].effectiveStatus, "pended");
    assert.equal(metrics.status, 200);
    assert.equal((await metrics.json()).pendedRate, 1);
    assert.equal(history.status, 200);
    assert.equal((await history.json()).payerUpdates[0].status, "pended");
    assert.equal(missing.status, 404);
  });
});
