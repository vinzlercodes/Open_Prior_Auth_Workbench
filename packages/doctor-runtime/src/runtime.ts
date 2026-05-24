import {
  executeDoctorTool,
  getDoctorToolDefinition,
  type DoctorToolError,
  type DoctorToolName
} from "@open-prior-auth/doctor-toolnet";
import {
  saveQuestionnaireResponse,
  submitMockPacket
} from "@open-prior-auth/prior-auth-core";
import type {
  AgentRun,
  AgentTask,
  ApprovalDecisionRequest,
  ApprovalDecisionResult,
  ApprovalRequest,
  DoctorRuntime,
  DoctorRuntimeDependencies,
  RuntimeToolExecutionRequest,
  RuntimeToolExecutionResult,
  TaskPlan,
  ToolCallRecord
} from "./types.js";

let defaultIdCounter = 0;

interface PreparedExecution {
  kind: "execute";
  run: AgentRun;
  task: AgentTask;
  startedAt: string;
}

export function createDoctorRuntime(dependencies: DoctorRuntimeDependencies): DoctorRuntime {
  return {
    executeRuntimeTool: (request) => executeRuntimeTool(request, dependencies),
    approveApprovalRequest: (request) => approveApprovalRequest(request, dependencies),
    rejectApprovalRequest: (request) => rejectApprovalRequest(request, dependencies)
  };
}

export async function executeRuntimeTool<Name extends DoctorToolName>(
  request: RuntimeToolExecutionRequest<Name>,
  dependencies: DoctorRuntimeDependencies
): Promise<RuntimeToolExecutionResult> {
  const actor = request.callContext?.actorUserId ?? "system";
  const definition = getDoctorToolDefinition(request.toolName);

  const prepared: RuntimeToolExecutionResult | PreparedExecution = dependencies.runtimeStore.transaction(() => {
    const { run, task } = ensureRunAndTask(request, dependencies);
    const startedAt = nowIso(dependencies);

    dependencies.runtimeStore.recordTraceEvent({
      runId: run.id,
      taskId: task.id,
      type: "tool_call.started",
      actor,
      message: `Started ${request.toolName}.`,
      data: { toolName: request.toolName }
    });

    if (definition.approval.approvalRequired) {
      const callId = generateId(dependencies, "tool-call");
      const approvalRequestId = generateId(dependencies, "approval");
      const record: ToolCallRecord = {
        callId,
        runId: run.id,
        taskId: task.id,
        toolName: definition.name,
        category: definition.category,
        riskLevel: definition.riskLevel,
        approvalRequired: true,
        approvalRequestId,
        status: "waiting_for_approval",
        startedAt,
        input: request.input
      };
      const approvalRequest: ApprovalRequest = {
        id: approvalRequestId,
        runId: run.id,
        taskId: task.id,
        toolCallId: callId,
        toolName: definition.name,
        riskLevel: definition.riskLevel,
        status: "pending",
        reason: definition.approval.reason ?? "Tool requires human approval.",
        requestedBy: actor,
        requestedAt: nowIso(dependencies),
        input: request.input
      };
      const pausedRun = saveRunStatus(run, "waiting_for_human", dependencies);
      const pausedTask = saveTaskStatus(task, "waiting_for_human", dependencies);
      dependencies.runtimeStore.saveToolCallRecord(record);
      dependencies.runtimeStore.saveApprovalRequest(approvalRequest);
      dependencies.runtimeStore.recordTraceEvent({
        runId: run.id,
        taskId: task.id,
        toolCallId: callId,
        approvalRequestId,
        type: "approval.requested",
        actor,
        message: `Approval requested for ${request.toolName}.`,
        data: { toolName: request.toolName, riskLevel: definition.riskLevel }
      });
      return {
        ok: false,
        run: pausedRun,
        task: pausedTask,
        record,
        error: {
          code: "APPROVAL_REQUIRED",
          message: `Tool ${request.toolName} is waiting for human approval.`
        },
        approvalRequest
      } satisfies RuntimeToolExecutionResult;
    }

    return { kind: "execute", run, task, startedAt };
  });

  if ("ok" in prepared) {
    return prepared;
  }

  const toolResult = await executeDoctorTool({
    toolName: request.toolName,
    input: request.input,
    callContext: {
      ...request.callContext,
      agentRunId: prepared.run.id,
      agentTaskId: prepared.task.id
    }
  }, dependencies.toolDependencies);

  return dependencies.runtimeStore.transaction(() => {
    const record: ToolCallRecord = {
      callId: toolResult.record.callId,
      runId: prepared.run.id,
      taskId: prepared.task.id,
      toolName: toolResult.record.toolName,
      category: toolResult.record.category,
      riskLevel: toolResult.record.riskLevel,
      approvalRequired: toolResult.record.approvalRequired,
      status: toolResult.record.status,
      startedAt: toolResult.record.startedAt,
      completedAt: toolResult.record.completedAt,
      input: toolResult.record.input,
      output: toolResult.record.output,
      error: toolResult.record.error
    };
    dependencies.runtimeStore.saveToolCallRecord(record);

    if (toolResult.ok) {
      const completedRun = saveRunStatus(prepared.run, "completed", dependencies, record.completedAt);
      const completedTask = saveTaskStatus(prepared.task, "completed", dependencies, record.completedAt);
      dependencies.runtimeStore.recordTraceEvent({
        runId: prepared.run.id,
        taskId: prepared.task.id,
        toolCallId: record.callId,
        type: "tool_call.succeeded",
        actor,
        message: `${request.toolName} completed.`,
        data: { toolName: request.toolName }
      });
      return {
        ok: true,
        run: completedRun,
        task: completedTask,
        record,
        output: toolResult.output
      };
    }

    const failedRun = saveRunStatus(prepared.run, "failed", dependencies, record.completedAt);
    const failedTask = saveTaskStatus(prepared.task, "failed", dependencies, record.completedAt);
    dependencies.runtimeStore.recordTraceEvent({
      runId: prepared.run.id,
      taskId: prepared.task.id,
      toolCallId: record.callId,
      type: "tool_call.failed",
      actor,
      message: `${request.toolName} failed.`,
      data: { error: toolResult.error }
    });
    return {
      ok: false,
      run: failedRun,
      task: failedTask,
      record,
      error: toolResult.error
    };
  });
}

export async function approveApprovalRequest(
  request: ApprovalDecisionRequest,
  dependencies: DoctorRuntimeDependencies
): Promise<ApprovalDecisionResult> {
  return decideApproval(request, "approved", dependencies);
}

export async function rejectApprovalRequest(
  request: ApprovalDecisionRequest,
  dependencies: DoctorRuntimeDependencies
): Promise<ApprovalDecisionResult> {
  return decideApproval(request, "rejected", dependencies);
}

interface ApprovedApprovalPreparation {
  approvalRequest: ApprovalRequest;
  run: AgentRun;
  task: AgentTask;
  record: ToolCallRecord;
  actor: string;
  decidedAt: string;
}

async function decideApproval(
  request: ApprovalDecisionRequest,
  decision: "approved" | "rejected",
  dependencies: DoctorRuntimeDependencies
): Promise<ApprovalDecisionResult> {
  const prepared = dependencies.runtimeStore.transaction<ApprovalDecisionResult | ApprovedApprovalPreparation>(() => {
    const approvalRequest = requireApprovalRequest(request.approvalRequestId, dependencies);
    if (approvalRequest.status !== "pending") {
      throw new Error(`Approval request ${approvalRequest.id} is already ${approvalRequest.status}.`);
    }
    const run = requireRun(approvalRequest.runId, dependencies);
    const task = requireTask(approvalRequest.taskId, dependencies);
    const record = requireToolCallRecord(approvalRequest.toolCallId, dependencies);
    const actor = request.actorUserId ?? "system";
    const decidedAt = nowIso(dependencies);

    if (decision === "rejected") {
      const rejectedApproval: ApprovalRequest = {
        ...approvalRequest,
        status: "rejected",
        decision: {
          approvalRequestId: approvalRequest.id,
          decision: "rejected",
          decidedBy: actor,
          decidedAt,
          reason: request.reason
        }
      };
      const rejectedRecord: ToolCallRecord = {
        ...record,
        status: "rejected",
        completedAt: decidedAt,
        error: {
          code: "APPROVAL_REJECTED",
          message: `Approval request ${approvalRequest.id} was rejected.`
        }
      };
      dependencies.runtimeStore.saveApprovalRequest(rejectedApproval);
      dependencies.runtimeStore.saveToolCallRecord(rejectedRecord);
      const rejectedRun = saveRunStatus(run, "rejected", dependencies, decidedAt);
      const rejectedTask = saveTaskStatus(task, "rejected", dependencies, decidedAt);
      dependencies.runtimeStore.recordTraceEvent({
        runId: run.id,
        taskId: task.id,
        toolCallId: record.callId,
        approvalRequestId: approvalRequest.id,
        type: "approval.rejected",
        actor,
        message: `Approval rejected for ${approvalRequest.toolName}.`,
        data: { reason: request.reason ?? null }
      });
      return {
        ok: false,
        run: rejectedRun,
        task: rejectedTask,
        record: rejectedRecord,
        approvalRequest: rejectedApproval,
        error: rejectedRecord.error!
      };
    }

    return { approvalRequest, run, task, record, actor, decidedAt };
  });

  if ("ok" in prepared) {
    return prepared;
  }

  try {
    const output = executeApprovedGuardedTool(prepared.approvalRequest, dependencies);
    return dependencies.runtimeStore.transaction(() => {
      const approvedApproval: ApprovalRequest = {
        ...prepared.approvalRequest,
        status: "approved",
        decision: {
          approvalRequestId: prepared.approvalRequest.id,
          decision: "approved",
          decidedBy: prepared.actor,
          decidedAt: prepared.decidedAt,
          reason: request.reason
        }
      };
      const succeededRecord: ToolCallRecord = {
        ...prepared.record,
        status: "succeeded",
        completedAt: nowIso(dependencies),
        output,
        error: undefined
      };
      dependencies.runtimeStore.saveApprovalRequest(approvedApproval);
      dependencies.runtimeStore.saveToolCallRecord(succeededRecord);
      const resumedRun = saveRunStatus(prepared.run, "running", dependencies);
      const completedTask = saveTaskStatus(prepared.task, "completed", dependencies, succeededRecord.completedAt);
      dependencies.runtimeStore.recordTraceEvent({
        runId: prepared.run.id,
        taskId: prepared.task.id,
        toolCallId: prepared.record.callId,
        approvalRequestId: prepared.approvalRequest.id,
        type: "approval.approved",
        actor: prepared.actor,
        message: `Approval approved for ${prepared.approvalRequest.toolName}.`,
        data: { toolName: prepared.approvalRequest.toolName }
      });
      dependencies.runtimeStore.recordTraceEvent({
        runId: prepared.run.id,
        taskId: prepared.task.id,
        toolCallId: prepared.record.callId,
        approvalRequestId: prepared.approvalRequest.id,
        type: "tool_call.succeeded",
        actor: prepared.actor,
        message: `${prepared.approvalRequest.toolName} completed after approval.`,
        data: { toolName: prepared.approvalRequest.toolName }
      });
      return {
        ok: true,
        run: resumedRun,
        task: completedTask,
        record: succeededRecord,
        approvalRequest: approvedApproval,
        output
      };
    });
  } catch (error) {
    const runtimeError = toRuntimeError(error);
    return dependencies.runtimeStore.transaction(() => {
      const approvedApproval: ApprovalRequest = {
        ...prepared.approvalRequest,
        status: "approved",
        decision: {
          approvalRequestId: prepared.approvalRequest.id,
          decision: "approved",
          decidedBy: prepared.actor,
          decidedAt: prepared.decidedAt,
          reason: request.reason
        }
      };
      const failedRecord: ToolCallRecord = {
        ...prepared.record,
        status: "failed",
        completedAt: nowIso(dependencies),
        error: runtimeError
      };
      dependencies.runtimeStore.saveApprovalRequest(approvedApproval);
      dependencies.runtimeStore.saveToolCallRecord(failedRecord);
      const failedRun = saveRunStatus(prepared.run, "failed", dependencies, failedRecord.completedAt);
      const failedTask = saveTaskStatus(prepared.task, "failed", dependencies, failedRecord.completedAt);
      dependencies.runtimeStore.recordTraceEvent({
        runId: prepared.run.id,
        taskId: prepared.task.id,
        toolCallId: prepared.record.callId,
        approvalRequestId: prepared.approvalRequest.id,
        type: "approval.approved",
        actor: prepared.actor,
        message: `Approval approved for ${prepared.approvalRequest.toolName}.`,
        data: { toolName: prepared.approvalRequest.toolName }
      });
      dependencies.runtimeStore.recordTraceEvent({
        runId: prepared.run.id,
        taskId: prepared.task.id,
        toolCallId: prepared.record.callId,
        approvalRequestId: prepared.approvalRequest.id,
        type: "tool_call.failed",
        actor: prepared.actor,
        message: `${prepared.approvalRequest.toolName} failed after approval.`,
        data: { error: runtimeError }
      });
      return {
        ok: false,
        run: failedRun,
        task: failedTask,
        record: failedRecord,
        approvalRequest: approvedApproval,
        error: runtimeError
      };
    });
  }
}

function executeApprovedGuardedTool(
  approvalRequest: ApprovalRequest,
  dependencies: DoctorRuntimeDependencies
): unknown {
  switch (approvalRequest.toolName) {
    case "doctor.dtr.save_response":
      return saveQuestionnaireResponse(
        approvalRequest.input as Parameters<typeof saveQuestionnaireResponse>[0],
        dependencies.toolDependencies.repository,
        dependencies.toolDependencies.store
      );
    case "doctor.pas.submit_mock":
      return submitMockPacket(
        approvalRequest.input as Parameters<typeof submitMockPacket>[0],
        dependencies.toolDependencies.repository,
        dependencies.toolDependencies.store
      );
    default:
      throw new Error(`Approval request ${approvalRequest.id} is not for a guarded runtime tool.`);
  }
}

function ensureRunAndTask(
  request: RuntimeToolExecutionRequest,
  dependencies: DoctorRuntimeDependencies
): { run: AgentRun; task: AgentTask } {
  let run = request.runId ? dependencies.runtimeStore.getRun(request.runId) : null;
  if (!run) {
    run = dependencies.runtimeStore.createRun({
      id: request.runId,
      objective: request.objective ?? `Execute ${request.toolName}.`,
      metadata: { source: "doctor-runtime" }
    });
    dependencies.runtimeStore.recordTraceEvent({
      runId: run.id,
      type: "run.started",
      actor: request.callContext?.actorUserId ?? "system",
      message: `Run ${run.id} started.`,
      data: { objective: run.objective }
    });
  }

  let task = request.taskId ? dependencies.runtimeStore.getTask(request.taskId) : null;
  if (!task) {
    task = dependencies.runtimeStore.createTask({
      id: request.taskId,
      runId: run.id,
      plan: request.taskPlan ?? defaultTaskPlan(request.toolName)
    });
    dependencies.runtimeStore.recordTraceEvent({
      runId: run.id,
      taskId: task.id,
      type: "task.started",
      actor: request.callContext?.actorUserId ?? "system",
      message: `Task ${task.id} started.`,
      data: { plan: task.plan }
    });
  } else if (task.status !== "running") {
    task = saveTaskStatus(task, "running", dependencies);
  }
  if (run.status !== "running") {
    run = saveRunStatus(run, "running", dependencies);
  }
  return { run, task };
}

function defaultTaskPlan(toolName: DoctorToolName): TaskPlan {
  return {
    objective: `Execute ${toolName}.`,
    steps: [`Call ${toolName}.`]
  };
}

function saveRunStatus(
  run: AgentRun,
  status: AgentRun["status"],
  dependencies: DoctorRuntimeDependencies,
  completedAt?: string
): AgentRun {
  const updated: AgentRun = {
    ...run,
    status,
    updatedAt: nowIso(dependencies),
    completedAt: completedAt ?? (["completed", "rejected", "failed"].includes(status) ? nowIso(dependencies) : undefined)
  };
  return dependencies.runtimeStore.saveRun(updated);
}

function saveTaskStatus(
  task: AgentTask,
  status: AgentTask["status"],
  dependencies: DoctorRuntimeDependencies,
  completedAt?: string
): AgentTask {
  const updated: AgentTask = {
    ...task,
    status,
    updatedAt: nowIso(dependencies),
    completedAt: completedAt ?? (["completed", "rejected", "failed"].includes(status) ? nowIso(dependencies) : undefined)
  };
  return dependencies.runtimeStore.saveTask(updated);
}

function requireRun(runId: string, dependencies: DoctorRuntimeDependencies): AgentRun {
  const run = dependencies.runtimeStore.getRun(runId);
  if (!run) {
    throw new Error(`Unknown agent run: ${runId}`);
  }
  return run;
}

function requireTask(taskId: string, dependencies: DoctorRuntimeDependencies): AgentTask {
  const task = dependencies.runtimeStore.getTask(taskId);
  if (!task) {
    throw new Error(`Unknown agent task: ${taskId}`);
  }
  return task;
}

function requireToolCallRecord(callId: string, dependencies: DoctorRuntimeDependencies): ToolCallRecord {
  const record = dependencies.runtimeStore.getToolCallRecord(callId);
  if (!record) {
    throw new Error(`Unknown tool call record: ${callId}`);
  }
  return record;
}

function requireApprovalRequest(approvalRequestId: string, dependencies: DoctorRuntimeDependencies): ApprovalRequest {
  const request = dependencies.runtimeStore.getApprovalRequest(approvalRequestId);
  if (!request) {
    throw new Error(`Unknown approval request: ${approvalRequestId}`);
  }
  return request;
}

function nowIso(dependencies: DoctorRuntimeDependencies): string {
  return dependencies.clock?.nowIso() ?? dependencies.runtimeStore.nowIso();
}

function generateId(dependencies: DoctorRuntimeDependencies, prefix: string): string {
  return dependencies.idGenerator?.generateId(prefix)
    ?? `runtime-${prefix}-${String(++defaultIdCounter).padStart(6, "0")}`;
}

function toRuntimeError(error: unknown): DoctorToolError {
  if (error instanceof Error) {
    return {
      code: "RUNTIME_TOOL_EXECUTION_FAILED",
      message: error.message
    };
  }
  return {
    code: "RUNTIME_TOOL_EXECUTION_FAILED",
    message: "Unknown runtime tool execution failure.",
    details: error
  };
}
