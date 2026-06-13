import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

const rootPackage = JSON.parse(readFileSync(resolve(process.cwd(), "package.json"), "utf8"));

test("agentic gap foundation packages and scripts are wired into the workspace", () => {
  for (const workspacePath of [
    "packages/doctor-policy/package.json",
    "packages/doctor-standards/package.json",
    "packages/doctor-workflow/package.json",
    "packages/doctor-mcp/package.json",
    "apps/mcp-server/package.json",
    "apps/worker/package.json"
  ]) {
    assert.equal(existsSync(resolve(process.cwd(), workspacePath)), true, `${workspacePath} should exist`);
  }

  for (const scriptName of ["dev:mcp", "dev:worker", "evals:report", "check", "package-boundaries"]) {
    assert.equal(typeof rootPackage.scripts[scriptName], "string", `${scriptName} should be a root script`);
  }
});

test("ToolNet metadata exposes policy, MCP, idempotency, and standards fields", async () => {
  const { getDoctorToolDefinition, listDoctorTools } = await import("../packages/doctor-toolnet/dist/index.js");
  const caseGet = getDoctorToolDefinition("doctor.case.get");
  const submitMock = getDoctorToolDefinition("doctor.pas.submit_mock");

  assert.equal(caseGet.sideEffect, "none");
  assert.equal(caseGet.idempotency, "not-applicable");
  assert.equal(caseGet.mcpExposure, "read-only");
  assert.deepEqual(caseGet.allowedAgents, ["orchestrator", "requirement", "documentation", "evidence", "packet", "compliance"]);
  assert.equal(typeof caseGet.standardsCapabilityId, "string");

  assert.equal(submitMock.sideEffect, "case-state");
  assert.equal(submitMock.idempotency, "required");
  assert.equal(submitMock.mcpExposure, "approval-gated");
  assert.equal(submitMock.approval.approvalRequired, true);

  assert.ok(listDoctorTools().every((tool) => tool.sideEffect && tool.idempotency && tool.mcpExposure));
});

test("policy package evaluates safe tools, guarded approvals, and standards overclaims", async () => {
  const {
    authorizeLocalAction,
    evaluateToolPolicy,
    evaluateStandardsClaimPolicy,
    PROMPT_INJECTION_MARKERS
  } = await import("../packages/doctor-policy/dist/index.js");

  const safe = evaluateToolPolicy({
    toolName: "doctor.case.get",
    riskLevel: "read",
    approvalRequired: false,
    executionMode: "local",
    agentName: "orchestrator",
    allowedAgents: ["orchestrator"],
    actorUserId: "policy-test-operator",
    inputSchemaValid: true
  });
  assert.equal(safe.allowed, true);
  assert.equal(safe.checks.every((check) => check.status === "passed"), true);

  const blocked = evaluateToolPolicy({
    toolName: "doctor.pas.submit_mock",
    riskLevel: "guarded_submit",
    approvalRequired: true,
    executionMode: "production",
    agentName: "evidence",
    allowedAgents: ["compliance"],
    actorUserId: undefined,
    inputSchemaValid: false
  });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.checks.some((check) => check.name === "tool.allowed_for_agent" && check.status === "failed"));
  assert.ok(blocked.checks.some((check) => check.name === "tool.execution_mode" && check.status === "failed"));
  assert.ok(blocked.checks.some((check) => check.name === "tool.input_schema" && check.status === "failed"));
  assert.ok(blocked.checks.some((check) => check.name === "audit.actor_present" && check.status === "failed"));

  assert.equal(evaluateStandardsClaimPolicy("This local demo is certified for PAS").allowed, false);
  assert.ok(PROMPT_INJECTION_MARKERS.some((marker) => marker.includes("IGNORE")));
  assert.equal(authorizeLocalAction({
    role: "reviewer",
    action: "approve",
    assignedCaseUserId: "reviewer-1",
    actorUserId: "reviewer-1"
  }).allowed, true);
  assert.equal(authorizeLocalAction({
    role: "operator",
    action: "submit",
    assignedCaseUserId: "operator-1",
    actorUserId: "operator-1"
  }).allowed, false);
});

test("standards catalog mirrors local non-conformant route capabilities", async () => {
  const { listStandardsCapabilities, getStandardsCapability } = await import("../packages/doctor-standards/dist/index.js");
  const capabilities = listStandardsCapabilities();

  assert.ok(capabilities.length >= 6);
  assert.ok(capabilities.every((capability) => capability.conformanceClaimAllowed === false));
  assert.ok(capabilities.every((capability) => capability.operationOutcomeBehavior.length > 0));
  assert.equal(getStandardsCapability("pas-claim-submit").standardFamily, "PAS");
});

test("workflow package stores checkpoints, signals, idempotency, and resumable pending work", async () => {
  const {
    InMemoryWorkflowStore,
    createWorkflowRun,
    recordWorkflowCheckpoint,
    signalWorkflow,
    reserveIdempotencyKey,
    resumeRun
  } = await import("../packages/doctor-workflow/dist/index.js");

  const store = new InMemoryWorkflowStore(() => "2026-04-25T12:00:00.000Z");
  const run = createWorkflowRun(store, {
    id: "wf-test-001",
    caseId: "wi-test-001",
    agentRunId: "run-test-001",
    workflowType: "prior-auth-replay"
  });
  recordWorkflowCheckpoint(store, {
    runId: run.id,
    name: "waiting-for-submit-approval",
    state: { approvalRequestId: "approval-001" }
  });
  signalWorkflow(store, {
    runId: run.id,
    type: "approval.approved",
    payload: { approvalRequestId: "approval-001" }
  });

  assert.equal(reserveIdempotencyKey(store, { runId: run.id, key: "tool-call-001" }).reserved, true);
  assert.equal(reserveIdempotencyKey(store, { runId: run.id, key: "tool-call-001" }).reserved, false);
  assert.equal(resumeRun(store, run.id)?.nextCheckpoint?.name, "waiting-for-submit-approval");
  assert.equal(resumeRun(store, run.id)?.signals.length, 1);
});

test("SQLite workflow store resumes checkpoints after process restart", async () => {
  const {
    SqliteWorkflowStore,
    createWorkflowRun,
    recordWorkflowCheckpoint,
    resumeRun
  } = await import("../packages/doctor-workflow/dist/index.js");
  const directory = mkdtempSync(join(tmpdir(), "doctor-workflow-"));
  const databasePath = join(directory, "workflow.sqlite");
  try {
    const firstStore = new SqliteWorkflowStore(databasePath, () => "2026-04-25T12:00:00.000Z");
    createWorkflowRun(firstStore, {
      id: "wf-sqlite-001",
      caseId: "wi-sqlite-001",
      agentRunId: "run-sqlite-001",
      workflowType: "prior-auth-replay"
    });
    recordWorkflowCheckpoint(firstStore, {
      runId: "wf-sqlite-001",
      name: "waiting-for-human",
      state: { approvalRequestId: "approval-sqlite-001" }
    });
    firstStore.close();

    const secondStore = new SqliteWorkflowStore(databasePath, () => "2026-04-25T12:00:01.000Z");
    assert.equal(resumeRun(secondStore, "wf-sqlite-001")?.nextCheckpoint?.name, "waiting-for-human");
    secondStore.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("MCP catalog exposes safe resources, prompts, and read-only tools only", async () => {
  const {
    listDoctorMcpResources,
    listDoctorMcpPrompts,
    listDoctorMcpTools,
    isDoctorMcpToolExposed
  } = await import("../packages/doctor-mcp/dist/index.js");

  assert.ok(listDoctorMcpResources().some((resource) => resource.uriTemplate === "doctor://cases/{id}/audit"));
  assert.ok(listDoctorMcpPrompts().some((prompt) => prompt.name === "summarize_agent_trace"));
  assert.ok(listDoctorMcpTools().some((tool) => tool.name === "doctor.case.get"));
  assert.equal(isDoctorMcpToolExposed("doctor.pas.submit_mock"), false);
});

test("MCP server handles JSON-RPC list requests for resources, prompts, and tools", async () => {
  const { handleMcpRequest } = await import("../apps/mcp-server/dist/index.js");

  const tools = handleMcpRequest({ jsonrpc: "2.0", id: 1, method: "tools/list" });
  const resources = handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "resources/list" });
  const prompts = handleMcpRequest({ jsonrpc: "2.0", id: 3, method: "prompts/list" });

  assert.equal(tools.id, 1);
  assert.ok(tools.result.tools.some((tool) => tool.name === "doctor.case.get"));
  assert.ok(resources.result.resources.some((resource) => resource.uriTemplate === "doctor://cases/{id}"));
  assert.ok(prompts.result.prompts.some((prompt) => prompt.name === "prepare_more_info_response"));
});

test("runtime exports agent runner planning interfaces", async () => {
  const runtime = await import("../packages/doctor-runtime/dist/index.js");

  for (const exportName of [
    "createAgentSpec",
    "createDeterministicPlanner",
    "createNoopHandoffRouter",
    "createNoopOutputValidator",
    "createReplayRunResumer"
  ]) {
    assert.equal(typeof runtime[exportName], "function", `${exportName} should be exported`);
  }
});

test("runtime records policy check trace events before tool execution", async () => {
  const { createDoctorRuntime, SqliteRuntimeStore } = await import("../packages/doctor-runtime/dist/index.js");
  const store = new SqliteRuntimeStore(":memory:", () => new Date("2026-04-25T12:00:00.000Z"));
  const runtime = createDoctorRuntime({
    runtimeStore: store,
    toolCatalog: {
      getToolDefinition(toolName) {
        return {
          name: toolName,
          category: "generic",
          riskLevel: "read",
          approval: { approvalRequired: false },
          executable: true
        };
      },
      async executeTool(request) {
        return {
          ok: true,
          output: { ok: true },
          record: {
            callId: "generic-call-0001",
            toolName: request.toolName,
            category: "generic",
            riskLevel: "read",
            approvalRequired: false,
            status: "succeeded",
            startedAt: "2026-04-25T12:00:00.000Z",
            completedAt: "2026-04-25T12:00:00.000Z",
            input: request.input,
            output: { ok: true }
          }
        };
      },
      executeApprovedTool() {
        throw new Error("not used");
      }
    }
  });

  const result = await runtime.executeRuntimeTool({
    objective: "Policy trace smoke test",
    toolName: "generic.read",
    input: { caseId: "wi-test-001" },
    callContext: { actorUserId: "policy-test-operator" }
  });

  assert.equal(result.ok, true);
  const trace = store.listTraceEvents(result.run.id);
  const policyEvent = trace.find((event) => event.type === "policy.checked");
  assert.ok(policyEvent);
  assert.deepEqual(policyEvent.data, {
    toolName: "generic.read",
    riskLevel: "read",
    approvalRequired: false,
    executable: true
  });
});

test("runtime approval requests carry lifecycle side-effect preview fields", async () => {
  const { createDoctorRuntime, SqliteRuntimeStore } = await import("../packages/doctor-runtime/dist/index.js");
  const store = new SqliteRuntimeStore(":memory:", () => new Date("2026-04-25T12:00:00.000Z"));
  const runtime = createDoctorRuntime({
    runtimeStore: store,
    toolCatalog: {
      getToolDefinition(toolName) {
        return {
          name: toolName,
          category: "generic",
          riskLevel: "guarded_write",
          approval: { approvalRequired: true, reason: "Generic write preview." },
          executable: false
        };
      },
      async executeTool() {
        throw new Error("not used");
      },
      executeApprovedTool() {
        return { ok: true };
      }
    }
  });

  const paused = await runtime.executeRuntimeTool({
    objective: "Approval lifecycle smoke test",
    toolName: "generic.write",
    input: { caseId: "wi-test-001", value: "after" },
    callContext: { actorUserId: "approval-test-agent" }
  });

  assert.equal(paused.ok, false);
  assert.equal(paused.approvalRequest.requestedByAgent, "approval-test-agent");
  assert.deepEqual(paused.approvalRequest.proposedInput, { caseId: "wi-test-001", value: "after" });
  assert.deepEqual(paused.approvalRequest.expectedAfterState, {
    toolName: "generic.write",
    riskLevel: "guarded_write"
  });

  const rejected = await runtime.rejectApprovalRequest({
    approvalRequestId: paused.approvalRequest.id,
    actorUserId: "reviewer",
    reason: "Missing required detail."
  });
  assert.equal(rejected.approvalRequest.rejectionReason, "Missing required detail.");
});

test("prior-auth agent team exports deterministic replay planner wrapper", async () => {
  const agentTeam = await import("../packages/prior-auth-agent-team/dist/index.js");

  assert.equal(typeof agentTeam.DeterministicPriorAuthReplayPlanner, "function");
  const planner = new agentTeam.DeterministicPriorAuthReplayPlanner();
  const plan = await planner.createPlan({ workItemId: "wi-test-001" });

  assert.deepEqual(plan.steps, [
    "List work queue.",
    "Read prior authorization case.",
    "Evaluate requirements.",
    "Prepare questionnaire response behind ApprovalGate.",
    "Map evidence to requirements.",
    "Build PAS-style packet preview.",
    "Request submit approval and pause."
  ]);
});
