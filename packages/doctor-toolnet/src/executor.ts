import {
  buildSubmissionPacket,
  evaluateRequirements,
  getCaseAuditTrace,
  getCaseStatusTimeline,
  getPriorAuthorizationCase,
  getQuestionnairePackage,
  listEvidence,
  listWorkItems
} from "@open-prior-auth/prior-auth-core";
import { approvalExecutorRequired, toDoctorToolError } from "./errors.js";
import { getDoctorToolDefinition, listDoctorTools } from "./registry.js";
import type {
  DoctorToolCallRecord,
  DoctorToolDependencies,
  DoctorToolExecutionRequest,
  DoctorToolExecutionResult,
  DoctorToolName,
  DoctorToolRegistry
} from "./types.js";

let defaultIdCounter = 0;

export function createDoctorToolRegistry(dependencies: DoctorToolDependencies): DoctorToolRegistry {
  return {
    listTools: listDoctorTools,
    getToolDefinition: getDoctorToolDefinition,
    executeTool: (request) => executeDoctorTool(request, dependencies)
  };
}

export async function executeDoctorTool<Name extends DoctorToolName>(
  request: DoctorToolExecutionRequest<Name>,
  dependencies: DoctorToolDependencies
): Promise<DoctorToolExecutionResult> {
  const definition = getDoctorToolDefinition(request.toolName);
  const startedAt = nowIso(dependencies);

  if (!definition.executable) {
    const error = approvalExecutorRequired(request.toolName);
    const record = completeRecord({
      dependencies,
      definition,
      input: request.input,
      startedAt,
      status: "blocked",
      error
    });
    return { ok: false, error, record };
  }

  try {
    const output = executeCoreTool(request, dependencies);
    const record = completeRecord({
      dependencies,
      definition,
      input: request.input,
      startedAt,
      status: "succeeded",
      output
    });
    return { ok: true, output, record };
  } catch (error) {
    const toolError = toDoctorToolError(error);
    const record = completeRecord({
      dependencies,
      definition,
      input: request.input,
      startedAt,
      status: "failed",
      error: toolError
    });
    return { ok: false, error: toolError, record };
  }
}

function executeCoreTool(
  request: DoctorToolExecutionRequest,
  dependencies: DoctorToolDependencies
) {
  switch (request.toolName) {
    case "doctor.case.get": {
      const input = request.input as { workItemId: string };
      return getPriorAuthorizationCase(input.workItemId, dependencies.store);
    }
    case "doctor.queue.list_work_items": {
      const input = request.input as { query?: Parameters<typeof listWorkItems>[1] };
      return listWorkItems(dependencies.store, input.query ?? {});
    }
    case "doctor.case.get_status_timeline": {
      const input = request.input as { workItemId: string };
      return getCaseStatusTimeline(input.workItemId, dependencies.store);
    }
    case "doctor.case.get_audit_trace": {
      const input = request.input as { workItemId: string };
      return getCaseAuditTrace(input.workItemId, dependencies.store);
    }
    case "doctor.evidence.list": {
      const input = request.input as { workItemId: string };
      return listEvidence(input.workItemId, dependencies.store, dependencies.uploadDirectory);
    }
    case "doctor.requirements.evaluate": {
      const input = request.input as { request: Parameters<typeof evaluateRequirements>[0] };
      return evaluateRequirements(input.request, dependencies.repository, dependencies.store);
    }
    case "doctor.dtr.get_questionnaire_package": {
      const input = request.input as { workItemId: string };
      return getQuestionnairePackage({ workItemId: input.workItemId }, dependencies.repository, dependencies.store);
    }
    case "doctor.pas.build_packet": {
      const input = request.input as Parameters<typeof buildSubmissionPacket>[0];
      return buildSubmissionPacket(input, dependencies.repository, dependencies.store);
    }
    case "doctor.dtr.save_response":
    case "doctor.pas.submit_mock":
      throw new Error("Guarded tool reached executable path.");
  }
}

function completeRecord(input: {
  dependencies: DoctorToolDependencies;
  definition: ReturnType<typeof getDoctorToolDefinition>;
  input: unknown;
  startedAt: string;
  status: DoctorToolCallRecord["status"];
  output?: unknown;
  error?: DoctorToolCallRecord["error"];
}): DoctorToolCallRecord {
  return {
    callId: generateId(input.dependencies),
    toolName: input.definition.name,
    category: input.definition.category,
    riskLevel: input.definition.riskLevel,
    approvalRequired: input.definition.approval.approvalRequired,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: nowIso(input.dependencies),
    input: input.input,
    output: input.output,
    error: input.error
  };
}

function nowIso(dependencies: DoctorToolDependencies): string {
  return dependencies.clock?.nowIso() ?? new Date().toISOString();
}

function generateId(dependencies: DoctorToolDependencies): string {
  return dependencies.idGenerator?.generateId("tool-call")
    ?? `tool-call-${String(++defaultIdCounter).padStart(6, "0")}`;
}
