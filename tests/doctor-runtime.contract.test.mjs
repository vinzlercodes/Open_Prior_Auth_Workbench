import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  buildSubmissionPacket,
  evaluateRequirement,
  saveQuestionnaireResponse
} from "../packages/prior-auth-core/dist/index.js";
import {
  createDoctorRuntime,
  executeRuntimeTool,
  runDeterministicPriorAuthAgentTeam,
  SqliteRuntimeStore
} from "../packages/doctor-runtime/dist/index.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";
import { SqliteStore } from "../apps/api/dist/storage/sqliteStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);
const dmeScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/dme-power-wheelchair.json"), "utf8")
);

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

function withTempDb(callback) {
  const directory = mkdtempSync(join(tmpdir(), "opa-runtime-"));
  const path = join(directory, "runtime.sqlite");
  let cleanupNow = true;
  try {
    const result = callback(path);
    if (result && typeof result.then === "function") {
      cleanupNow = false;
      return result.finally(() => rmSync(directory, { recursive: true, force: true }));
    }
    return result;
  } finally {
    if (cleanupNow) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
}

function createClock(start = "2026-04-25T12:00:00.000Z") {
  let current = new Date(start);
  return {
    clock: () => current,
    nowIso: () => current.toISOString(),
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    }
  };
}

function createIds() {
  let next = 0;
  return {
    generateId: (prefix = "runtime") => `${prefix}-${String(++next).padStart(4, "0")}`
  };
}

function createFixture(runtimePath = ":memory:", scenario = goldenScenario) {
  const time = createClock();
  const repository = new FixtureFhirRepository(scenario.bundlePath);
  const priorAuthStore = new MemoryStore(time.clock);
  const runtimeStore = new SqliteRuntimeStore(runtimePath, time.clock);
  const result = priorAuthStore.saveEvaluation(
    scenario.request,
    evaluateRequirement(scenario.request, repository)
  );
  const workItem = priorAuthStore.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "runtime-test-operator"
  });
  const toolDependencies = {
    repository,
    store: priorAuthStore,
    clock: time,
    idGenerator: createIds()
  };
  const runtimeDependencies = {
    runtimeStore,
    toolDependencies,
    clock: time,
    idGenerator: createIds()
  };
  const runtime = createDoctorRuntime(runtimeDependencies);

  return {
    ...time,
    repository,
    priorAuthStore,
    runtime,
    runtimeDependencies,
    runtimeStore,
    toolDependencies,
    workItem
  };
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

function preparePacket(fixture) {
  const packageResult = fixture.runtime.executeRuntimeTool({
    toolName: "doctor.dtr.get_questionnaire_package",
    input: { workItemId: fixture.workItem.id },
    callContext: { actorUserId: "runtime-test-operator" }
  });
  return packageResult.then((result) => {
    assert.equal(result.ok, true);
    saveQuestionnaireResponse({
      workItemId: fixture.workItem.id,
      questionnaireResponse: completeResponse(clone(result.output.questionnaireResponse)),
      revision: result.output.session.revision,
      actorUserId: "runtime-test-operator",
      markReadyForReview: true
    }, fixture.repository, fixture.priorAuthStore);
    return buildSubmissionPacket({
      workItemId: fixture.workItem.id,
      actorUserId: "runtime-test-operator"
    }, fixture.repository, fixture.priorAuthStore);
  });
}

test("M2 package exports runtime surface and keeps source boundary clean", () => {
  assert.equal(typeof createDoctorRuntime, "function");
  assert.equal(typeof executeRuntimeTool, "function");
  assert.equal(typeof runDeterministicPriorAuthAgentTeam, "function");
  assert.equal(typeof SqliteRuntimeStore, "function");

  const declaration = readFileSync(
    resolve(process.cwd(), "packages/doctor-runtime/dist/index.d.ts"),
    "utf8"
  );
  for (const exportedType of [
    "AgentRun",
    "AgentTask",
    "TaskPlan",
    "ToolCallRecord",
    "ApprovalRequest",
    "ApprovalDecision",
    "TraceEvent",
    "PriorAuthOrchestratorAgent",
    "RequirementDiscoveryAgent",
    "DocumentationAgent",
    "EvidenceAgent",
    "PacketAssemblyAgent",
    "ComplianceBoundaryAgent",
    "runDeterministicPriorAuthAgentTeam"
  ]) {
    assert.ok(declaration.includes(exportedType), `Expected ${exportedType} export`);
  }

  const runtimeSource = sourceFiles(resolve(process.cwd(), "packages/doctor-runtime/src"))
    .filter((path) => path.endsWith(".ts"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  for (const forbidden of ["apps/api", "../apps", "localhost", "127.0.0.1", "fetch(", "http.request", "https.request"]) {
    assert.ok(!runtimeSource.includes(forbidden), `Runtime source must not include ${forbidden}`);
  }
});

test("SQLite runtime store creates required tables and persists ordered trace", () => withTempDb((path) => {
  const time = createClock();
  const store = new SqliteRuntimeStore(path, time.clock);
  const run = store.createRun({ objective: "Persist runtime trace." });
  const task = store.createTask({
    runId: run.id,
    plan: { objective: "Persist trace events.", steps: ["Record first.", "Record second."] }
  });
  store.recordTraceEvent({
    runId: run.id,
    taskId: task.id,
    type: "test.first",
    actor: "runtime-test-operator",
    message: "First event.",
    data: { order: 1 }
  });
  store.recordTraceEvent({
    runId: run.id,
    taskId: task.id,
    type: "test.second",
    actor: "runtime-test-operator",
    message: "Second event.",
    data: { order: 2 }
  });
  store.close();

  const db = new DatabaseSync(path, { readBigInts: false, returnArrays: false });
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type = 'table'
      AND name IN ('agent_runs','agent_tasks','tool_call_records','approval_requests','agent_trace_events')
    ORDER BY name
  `).all().map((row) => row.name);
  db.close();

  const reopened = new SqliteRuntimeStore(path, time.clock);
  const trace = reopened.listTraceEvents(run.id);
  assert.deepEqual(tables, [
    "agent_runs",
    "agent_tasks",
    "agent_trace_events",
    "approval_requests",
    "tool_call_records"
  ]);
  assert.deepEqual(trace.map((event) => event.sequence), [1, 2]);
  assert.deepEqual(trace.map((event) => event.type), ["test.first", "test.second"]);
  reopened.close();
}));

test("unguarded runtime tool executes through ToolNet and records durable trace", async () => {
  const fixture = createFixture();
  const result = await fixture.runtime.executeRuntimeTool({
    toolName: "doctor.case.get",
    input: { workItemId: fixture.workItem.id },
    objective: "Read prior authorization case.",
    callContext: { actorUserId: "runtime-test-operator" }
  });

  assert.equal(result.ok, true);
  assert.equal(result.output.id, fixture.workItem.id);
  assert.equal(result.run.status, "completed");
  assert.equal(result.task.status, "completed");
  assert.equal(result.record.status, "succeeded");
  assert.equal(fixture.runtimeStore.getToolCallRecord(result.record.callId).toolName, "doctor.case.get");

  const trace = fixture.runtimeStore.listTraceEvents(result.run.id);
  assert.deepEqual(trace.map((event) => event.sequence), [1, 2, 3, 4]);
  assert.ok(trace.some((event) => event.type === "tool_call.succeeded"));
  fixture.runtimeStore.close();
});

test("guarded questionnaire save pauses without mutation and approval resumes run", async () => {
  const fixture = createFixture();
  const packageResult = await fixture.runtime.executeRuntimeTool({
    toolName: "doctor.dtr.get_questionnaire_package",
    input: { workItemId: fixture.workItem.id },
    callContext: { actorUserId: "runtime-test-operator" }
  });
  assert.equal(packageResult.ok, true);

  const sessionBefore = clone(fixture.priorAuthStore.getQuestionnaireSessionsForWorkItem(fixture.workItem.id)[0]);
  const statusBefore = fixture.priorAuthStore.getWorkItem(fixture.workItem.id).status;
  const pause = await fixture.runtime.executeRuntimeTool({
    toolName: "doctor.dtr.save_response",
    input: {
      workItemId: fixture.workItem.id,
      questionnaireResponse: completeResponse(clone(packageResult.output.questionnaireResponse)),
      revision: packageResult.output.session.revision,
      actorUserId: "runtime-test-operator",
      markReadyForReview: true
    },
    callContext: { actorUserId: "runtime-test-operator" }
  });

  assert.equal(pause.ok, false);
  assert.equal(pause.run.status, "waiting_for_human");
  assert.equal(pause.task.status, "waiting_for_human");
  assert.equal(pause.record.status, "waiting_for_approval");
  assert.equal(pause.approvalRequest.status, "pending");
  assert.deepEqual(fixture.priorAuthStore.getQuestionnaireSessionsForWorkItem(fixture.workItem.id)[0], sessionBefore);
  assert.equal(fixture.priorAuthStore.getWorkItem(fixture.workItem.id).status, statusBefore);

  const approved = await fixture.runtime.approveApprovalRequest({
    approvalRequestId: pause.approvalRequest.id,
    actorUserId: "runtime-test-approver",
    reason: "Synthetic test approval."
  });

  assert.equal(approved.ok, true);
  assert.equal(approved.run.status, "running");
  assert.equal(approved.task.status, "completed");
  assert.equal(approved.record.status, "succeeded");
  assert.equal(approved.approvalRequest.status, "approved");
  assert.equal(fixture.priorAuthStore.getQuestionnaireSessionsForWorkItem(fixture.workItem.id)[0].status, "review_ready");
  assert.equal(fixture.priorAuthStore.getWorkItem(fixture.workItem.id).status, "review_ready");
  assert.ok(fixture.runtimeStore.listTraceEvents(approved.run.id).some((event) => event.type === "approval.approved"));
  fixture.runtimeStore.close();
});

test("guarded submit reject keeps receipt absent and marks run rejected", async () => {
  const fixture = createFixture();
  const packet = await preparePacket(fixture);
  const pause = await fixture.runtime.executeRuntimeTool({
    toolName: "doctor.pas.submit_mock",
    input: {
      packetId: packet.id,
      actorUserId: "runtime-test-operator"
    },
    callContext: { actorUserId: "runtime-test-operator" }
  });

  assert.equal(pause.ok, false);
  assert.equal(fixture.priorAuthStore.getSubmissionReceiptsForWorkItem(fixture.workItem.id).length, 0);

  const rejected = await fixture.runtime.rejectApprovalRequest({
    approvalRequestId: pause.approvalRequest.id,
    actorUserId: "runtime-test-approver",
    reason: "Need human revision."
  });

  assert.equal(rejected.ok, false);
  assert.equal(rejected.run.status, "rejected");
  assert.equal(rejected.task.status, "rejected");
  assert.equal(rejected.record.status, "rejected");
  assert.equal(rejected.approvalRequest.status, "rejected");
  assert.equal(fixture.priorAuthStore.getSubmissionReceiptsForWorkItem(fixture.workItem.id).length, 0);
  assert.equal(fixture.priorAuthStore.getWorkItem(fixture.workItem.id).status, "packet_ready");
  fixture.runtimeStore.close();
});

test("guarded submit approve creates receipt and moves work item to submitted", async () => {
  const fixture = createFixture();
  const packet = await preparePacket(fixture);
  const pause = await fixture.runtime.executeRuntimeTool({
    toolName: "doctor.pas.submit_mock",
    input: {
      packetId: packet.id,
      actorUserId: "runtime-test-operator"
    },
    callContext: { actorUserId: "runtime-test-operator" }
  });

  assert.equal(pause.ok, false);
  assert.equal(fixture.priorAuthStore.getSubmissionReceiptsForWorkItem(fixture.workItem.id).length, 0);

  const approved = await fixture.runtime.approveApprovalRequest({
    approvalRequestId: pause.approvalRequest.id,
    actorUserId: "runtime-test-approver",
    reason: "Submit synthetic packet."
  });

  assert.equal(approved.ok, true);
  assert.equal(approved.record.status, "succeeded");
  assert.equal(approved.approvalRequest.status, "approved");
  assert.equal(fixture.priorAuthStore.getSubmissionReceiptsForWorkItem(fixture.workItem.id).length, 1);
  assert.equal(fixture.priorAuthStore.getWorkItem(fixture.workItem.id).status, "submitted");
  assert.equal(approved.output.packetId, packet.id);
  fixture.runtimeStore.close();
});

test("approval execution releases runtime transaction before writing to same SQLite database", async () => withTempDb(async (path) => {
  const time = createClock();
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const priorAuthStore = new SqliteStore(path, time.clock);
  const runtimeStore = new SqliteRuntimeStore(path, time.clock);
  const result = priorAuthStore.saveEvaluation(
    goldenScenario.request,
    evaluateRequirement(goldenScenario.request, repository)
  );
  const workItem = priorAuthStore.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "runtime-sqlite-operator"
  });
  const runtime = createDoctorRuntime({
    runtimeStore,
    toolDependencies: {
      repository,
      store: priorAuthStore,
      clock: time,
      idGenerator: createIds()
    },
    clock: time,
    idGenerator: createIds()
  });
  const packageResult = await runtime.executeRuntimeTool({
    toolName: "doctor.dtr.get_questionnaire_package",
    input: { workItemId: workItem.id },
    callContext: { actorUserId: "runtime-sqlite-operator" }
  });
  assert.equal(packageResult.ok, true);
  const pause = await runtime.executeRuntimeTool({
    toolName: "doctor.dtr.save_response",
    input: {
      workItemId: workItem.id,
      questionnaireResponse: completeResponse(clone(packageResult.output.questionnaireResponse)),
      revision: packageResult.output.session.revision,
      actorUserId: "runtime-sqlite-operator",
      markReadyForReview: true
    },
    callContext: { actorUserId: "runtime-sqlite-operator" }
  });
  assert.equal(pause.ok, false);

  const approved = await runtime.approveApprovalRequest({
    approvalRequestId: pause.approvalRequest.id,
    actorUserId: "runtime-sqlite-approver",
    reason: "Approve same-database questionnaire save."
  });

  assert.equal(approved.ok, true);
  assert.equal(priorAuthStore.getWorkItem(workItem.id).status, "review_ready");
  assert.equal(runtimeStore.getApprovalRequest(pause.approvalRequest.id).status, "approved");
  runtimeStore.close();
  priorAuthStore.close();
}));

test("M3 deterministic prior-auth agent team produces golden ordered trace and waits on submit approval", async () => {
  const fixture = createFixture();

  const result = await runDeterministicPriorAuthAgentTeam({
    workItemId: fixture.workItem.id,
    actorUserId: "m3-test-agent",
    questionnaireApprovalActorUserId: "m3-test-approver"
  }, fixture.runtimeDependencies);

  assert.equal(result.run.status, "waiting_for_human");
  assert.equal(result.workItemId, fixture.workItem.id);
  assert.equal(result.packet.workItemId, fixture.workItem.id);
  assert.equal(result.submitApprovalRequest.toolName, "doctor.pas.submit_mock");
  assert.equal(result.submitApprovalRequest.status, "pending");
  assert.equal(result.questionnaireApprovalRequest.toolName, "doctor.dtr.save_response");
  assert.equal(result.questionnaireApprovalRequest.status, "approved");
  assert.equal(
    fixture.runtimeStore.getApprovalRequest(result.questionnaireApprovalRequest.id).status,
    "approved"
  );
  assert.equal(fixture.priorAuthStore.getSubmissionReceiptsForWorkItem(fixture.workItem.id).length, 0);

  const agentStartedOrder = result.trace
    .filter((event) => event.type === "agent.started")
    .map((event) => event.data.agentRole);
  assert.deepEqual(agentStartedOrder, [
    "orchestrator",
    "requirement",
    "documentation",
    "evidence",
    "packet",
    "compliance"
  ]);

  const toolStartedOrder = result.trace
    .filter((event) => event.type === "tool_call.started")
    .map((event) => event.data.toolName);
  assert.deepEqual(toolStartedOrder, [
    "doctor.queue.list_work_items",
    "doctor.case.get",
    "doctor.requirements.evaluate",
    "doctor.dtr.get_questionnaire_package",
    "doctor.dtr.save_response",
    "doctor.evidence.list",
    "doctor.pas.build_packet",
    "doctor.pas.submit_mock"
  ]);

  assert.deepEqual(result.steps.map((step) => step.agent), [
    "requirement",
    "documentation",
    "evidence",
    "packet",
    "compliance"
  ]);
  assert.equal(result.steps.at(-1).status, "waiting_for_human");
  fixture.runtimeStore.close();
});

test("M4 deterministic prior-auth agent team reuses the same workflow for DME", async () => {
  const fixture = createFixture(":memory:", dmeScenario);

  const result = await runDeterministicPriorAuthAgentTeam({
    workItemId: fixture.workItem.id,
    actorUserId: "m4-dme-test-agent",
    questionnaireApprovalActorUserId: "m4-dme-test-approver"
  }, fixture.runtimeDependencies);

  assert.equal(result.run.status, "waiting_for_human");
  assert.equal(result.caseRoot.workItem.serviceLine, "dme_power_wheelchair");
  assert.equal(result.requirementEvaluation.matchedRuleId, "dme-pwc-blue-ridge-001");
  assert.equal(result.questionnaireApprovalRequest.status, "approved");
  assert.equal(result.packet.workItemId, fixture.workItem.id);
  assert.equal(result.submitApprovalRequest.toolName, "doctor.pas.submit_mock");
  assert.equal(result.submitApprovalRequest.status, "pending");

  const toolStartedOrder = result.trace
    .filter((event) => event.type === "tool_call.started")
    .map((event) => event.data.toolName);
  assert.deepEqual(toolStartedOrder, [
    "doctor.queue.list_work_items",
    "doctor.case.get",
    "doctor.requirements.evaluate",
    "doctor.dtr.get_questionnaire_package",
    "doctor.dtr.save_response",
    "doctor.evidence.list",
    "doctor.pas.build_packet",
    "doctor.pas.submit_mock"
  ]);
  assert.deepEqual(result.steps.map((step) => step.agent), [
    "requirement",
    "documentation",
    "evidence",
    "packet",
    "compliance"
  ]);
  fixture.runtimeStore.close();
});
