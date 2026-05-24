import type {
  EvidenceListResponse,
  FhirQuestionnaireResponse,
  FhirQuestionnaireResponseAnswer,
  QuestionnairePackage,
  RequirementEvaluationResult,
  SubmissionPacket,
  WorkItemQueueQuery,
  WorkItemQueueRow
} from "@open-prior-auth/shared-types";
import type { PriorAuthorizationCase } from "@open-prior-auth/prior-auth-core";
import type {
  AgentRun,
  ApprovalRequest,
  DoctorRuntimeDependencies,
  RuntimeToolExecutionResult,
  TraceEvent
} from "./types.js";
import { approveApprovalRequest, executeRuntimeTool } from "./runtime.js";

export interface DeterministicPriorAuthAgentTeamRequest {
  workItemId?: string;
  queueQuery?: WorkItemQueueQuery;
  actorUserId?: string;
  questionnaireApprovalActorUserId?: string;
}

export interface DeterministicPriorAuthAgentStep {
  agent: PriorAuthAgentRole;
  toolName?: string;
  status: "completed" | "waiting_for_human";
  summary: string;
}

export interface DeterministicPriorAuthAgentTeamResult {
  run: AgentRun;
  workItemId: string;
  caseRoot: PriorAuthorizationCase;
  requirementEvaluation: RequirementEvaluationResult;
  questionnaireApprovalRequest: ApprovalRequest;
  evidence: EvidenceListResponse;
  packet: SubmissionPacket;
  submitApprovalRequest: ApprovalRequest;
  trace: TraceEvent[];
  steps: DeterministicPriorAuthAgentStep[];
}

export type PriorAuthAgentRole =
  | "orchestrator"
  | "requirement"
  | "documentation"
  | "evidence"
  | "packet"
  | "compliance";

interface AgentContext {
  runId: string;
  actorUserId: string;
  questionnaireApprovalActorUserId: string;
  steps: DeterministicPriorAuthAgentStep[];
}

interface RequirementDiscoveryResult {
  workItemId: string;
  caseRoot: PriorAuthorizationCase;
  requirementEvaluation: RequirementEvaluationResult;
}

interface DocumentationResult {
  package: QuestionnairePackage;
  questionnaireApprovalRequest: ApprovalRequest;
}

export async function runDeterministicPriorAuthAgentTeam(
  request: DeterministicPriorAuthAgentTeamRequest,
  dependencies: DoctorRuntimeDependencies
): Promise<DeterministicPriorAuthAgentTeamResult> {
  return new PriorAuthOrchestratorAgent(dependencies).run(request);
}

export class PriorAuthOrchestratorAgent {
  constructor(private readonly dependencies: DoctorRuntimeDependencies) {}

  async run(request: DeterministicPriorAuthAgentTeamRequest = {}): Promise<DeterministicPriorAuthAgentTeamResult> {
    const actorUserId = request.actorUserId ?? "m3-deterministic-agent";
    const run = this.dependencies.runtimeStore.createRun({
      objective: "Run deterministic prior authorization agent team.",
      metadata: {
        source: "m3-deterministic-prior-auth-agent-team",
        deterministic: true
      }
    });
    const context: AgentContext = {
      runId: run.id,
      actorUserId,
      questionnaireApprovalActorUserId: request.questionnaireApprovalActorUserId ?? "m3-scripted-approver",
      steps: []
    };

    recordRunStarted(run.id, actorUserId, this.dependencies);
    recordAgentStarted("orchestrator", context, this.dependencies);

    const requirement = await new RequirementDiscoveryAgent(this.dependencies).run({
      context,
      workItemId: request.workItemId,
      queueQuery: request.queueQuery ?? { sort: "age_desc" }
    });
    const documentation = await new DocumentationAgent(this.dependencies).run(context, requirement.workItemId);
    const evidence = await new EvidenceAgent(this.dependencies).run(context, requirement.workItemId);
    const packet = await new PacketAssemblyAgent(this.dependencies).run(context, requirement.workItemId);
    const submitApprovalRequest = await new ComplianceBoundaryAgent(this.dependencies).run(context, packet.id);

    recordAgentCompleted("orchestrator", context, this.dependencies);

    const finalRun = this.dependencies.runtimeStore.getRun(run.id);
    if (!finalRun) {
      throw new Error(`Unknown agent run after deterministic team execution: ${run.id}`);
    }

    return {
      run: finalRun,
      workItemId: requirement.workItemId,
      caseRoot: requirement.caseRoot,
      requirementEvaluation: requirement.requirementEvaluation,
      questionnaireApprovalRequest: documentation.questionnaireApprovalRequest,
      evidence,
      packet,
      submitApprovalRequest,
      trace: this.dependencies.runtimeStore.listTraceEvents(run.id),
      steps: context.steps
    };
  }
}

export class RequirementDiscoveryAgent {
  constructor(private readonly dependencies: DoctorRuntimeDependencies) {}

  async run(input: {
    context: AgentContext;
    workItemId?: string;
    queueQuery: WorkItemQueueQuery;
  }): Promise<RequirementDiscoveryResult> {
    recordAgentStarted("requirement", input.context, this.dependencies);

    const queue = await executeRequiredTool<WorkItemQueueRow[]>(
      this.dependencies,
      input.context,
      "doctor.queue.list_work_items",
      { query: input.queueQuery }
    );
    const selected = selectWorkItem(queue, input.workItemId);
    const caseRoot = await executeRequiredTool<PriorAuthorizationCase>(
      this.dependencies,
      input.context,
      "doctor.case.get",
      { workItemId: selected.workItemId }
    );
    const requirementEvaluation = await executeRequiredTool<RequirementEvaluationResult>(
      this.dependencies,
      input.context,
      "doctor.requirements.evaluate",
      {
        request: {
          patientId: caseRoot.workItem.patientId,
          coverageId: caseRoot.workItem.coverageId,
          requestResourceType: caseRoot.workItem.requestResourceType,
          requestResourceId: caseRoot.workItem.requestResourceId,
          serviceLine: caseRoot.workItem.serviceLine,
          payerId: caseRoot.workItem.payerId
        }
      }
    );

    input.context.steps.push({
      agent: "requirement",
      toolName: "doctor.requirements.evaluate",
      status: "completed",
      summary: `Requirement evaluation ${requirementEvaluation.evaluationId} completed.`
    });
    recordAgentCompleted("requirement", input.context, this.dependencies);
    return {
      workItemId: selected.workItemId,
      caseRoot,
      requirementEvaluation
    };
  }
}

export class DocumentationAgent {
  constructor(private readonly dependencies: DoctorRuntimeDependencies) {}

  async run(context: AgentContext, workItemId: string): Promise<DocumentationResult> {
    recordAgentStarted("documentation", context, this.dependencies);

    const questionnairePackage = await executeRequiredTool<QuestionnairePackage>(
      this.dependencies,
      context,
      "doctor.dtr.get_questionnaire_package",
      { workItemId }
    );
    const questionnaireResponse = completeMriQuestionnaireResponse(questionnairePackage.questionnaireResponse);
    const pause = await executeRuntimeTool({
      runId: context.runId,
      toolName: "doctor.dtr.save_response",
      input: {
        workItemId,
        questionnaireResponse,
        revision: questionnairePackage.session.revision,
        actorUserId: context.actorUserId,
        markReadyForReview: true
      },
      callContext: { actorUserId: context.actorUserId }
    }, this.dependencies);

    if (pause.ok || pause.error.code !== "APPROVAL_REQUIRED" || !pause.approvalRequest) {
      throw new Error("Expected questionnaire save to pause for ApprovalGate.");
    }

    const approved = await approveApprovalRequest({
      approvalRequestId: pause.approvalRequest.id,
      actorUserId: context.questionnaireApprovalActorUserId,
      reason: "M3 scripted approval for deterministic questionnaire save."
    }, this.dependencies);

    if (!approved.ok) {
      throw new Error(`Scripted questionnaire approval failed: ${approved.error.message}`);
    }

    context.steps.push({
      agent: "documentation",
      toolName: "doctor.dtr.save_response",
      status: "completed",
      summary: `Questionnaire save approval ${approved.approvalRequest.id} completed.`
    });
    recordAgentCompleted("documentation", context, this.dependencies);
    return {
      package: questionnairePackage,
      questionnaireApprovalRequest: approved.approvalRequest
    };
  }
}

export class EvidenceAgent {
  constructor(private readonly dependencies: DoctorRuntimeDependencies) {}

  async run(context: AgentContext, workItemId: string): Promise<EvidenceListResponse> {
    recordAgentStarted("evidence", context, this.dependencies);
    const evidence = await executeRequiredTool<EvidenceListResponse>(
      this.dependencies,
      context,
      "doctor.evidence.list",
      { workItemId }
    );
    context.steps.push({
      agent: "evidence",
      toolName: "doctor.evidence.list",
      status: "completed",
      summary: `Evidence list returned ${evidence.attachments.length} attachments.`
    });
    recordAgentCompleted("evidence", context, this.dependencies);
    return evidence;
  }
}

export class PacketAssemblyAgent {
  constructor(private readonly dependencies: DoctorRuntimeDependencies) {}

  async run(context: AgentContext, workItemId: string): Promise<SubmissionPacket> {
    recordAgentStarted("packet", context, this.dependencies);
    const packet = await executeRequiredTool<SubmissionPacket>(
      this.dependencies,
      context,
      "doctor.pas.build_packet",
      { workItemId, actorUserId: context.actorUserId }
    );
    context.steps.push({
      agent: "packet",
      toolName: "doctor.pas.build_packet",
      status: "completed",
      summary: `Packet ${packet.id} built.`
    });
    recordAgentCompleted("packet", context, this.dependencies);
    return packet;
  }
}

export class ComplianceBoundaryAgent {
  constructor(private readonly dependencies: DoctorRuntimeDependencies) {}

  async run(context: AgentContext, packetId: string): Promise<ApprovalRequest> {
    recordAgentStarted("compliance", context, this.dependencies);
    const pause = await executeRuntimeTool({
      runId: context.runId,
      toolName: "doctor.pas.submit_mock",
      input: {
        packetId,
        actorUserId: context.actorUserId
      },
      callContext: { actorUserId: context.actorUserId }
    }, this.dependencies);

    if (pause.ok || pause.error.code !== "APPROVAL_REQUIRED" || !pause.approvalRequest) {
      throw new Error("Expected PAS mock submit to pause for ApprovalGate.");
    }

    context.steps.push({
      agent: "compliance",
      toolName: "doctor.pas.submit_mock",
      status: "waiting_for_human",
      summary: `Submit approval ${pause.approvalRequest.id} is pending.`
    });
    recordAgentCompleted("compliance", context, this.dependencies);
    return pause.approvalRequest;
  }
}

async function executeRequiredTool<Output>(
  dependencies: DoctorRuntimeDependencies,
  context: AgentContext,
  toolName: Parameters<typeof executeRuntimeTool>[0]["toolName"],
  input: Parameters<typeof executeRuntimeTool>[0]["input"]
): Promise<Output> {
  const result = await executeRuntimeTool({
    runId: context.runId,
    toolName,
    input,
    callContext: { actorUserId: context.actorUserId }
  }, dependencies) as RuntimeToolExecutionResult;

  if (!result.ok) {
    throw new Error(`${toolName} failed: ${result.error.message}`);
  }
  return result.output as Output;
}

function selectWorkItem(queue: WorkItemQueueRow[], requestedWorkItemId?: string): WorkItemQueueRow {
  const selected = requestedWorkItemId
    ? queue.find((row) => row.workItemId === requestedWorkItemId)
    : queue[0];
  if (!selected) {
    throw new Error(requestedWorkItemId
      ? `Work item ${requestedWorkItemId} was not present in the queue.`
      : "No work items are available for deterministic prior-auth agent team.");
  }
  return selected;
}

function completeMriQuestionnaireResponse(response: FhirQuestionnaireResponse): FhirQuestionnaireResponse {
  const next = clone(response);
  setAnswer(next, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: "routine",
      display: "Routine"
    }
  });
  setAnswer(next, "prior-spine-surgery", { valueBoolean: false });
  return next;
}

function setAnswer(
  response: FhirQuestionnaireResponse,
  linkId: string,
  answer: FhirQuestionnaireResponseAnswer
): void {
  const item = response.item.find((candidate) => candidate.linkId === linkId);
  if (!item) {
    throw new Error(`QuestionnaireResponse item ${linkId} not found.`);
  }
  item.answer = [answer];
}

function recordRunStarted(
  runId: string,
  actor: string,
  dependencies: DoctorRuntimeDependencies
): void {
  dependencies.runtimeStore.recordTraceEvent({
    runId,
    type: "run.started",
    actor,
    message: `Run ${runId} started.`,
    data: { objective: "Run deterministic prior authorization agent team." }
  });
}

function recordAgentStarted(
  role: PriorAuthAgentRole,
  context: AgentContext,
  dependencies: DoctorRuntimeDependencies
): void {
  dependencies.runtimeStore.recordTraceEvent({
    runId: context.runId,
    type: "agent.started",
    actor: context.actorUserId,
    message: `${role} agent started.`,
    data: { agentRole: role }
  });
}

function recordAgentCompleted(
  role: PriorAuthAgentRole,
  context: AgentContext,
  dependencies: DoctorRuntimeDependencies
): void {
  dependencies.runtimeStore.recordTraceEvent({
    runId: context.runId,
    type: "agent.completed",
    actor: context.actorUserId,
    message: `${role} agent completed.`,
    data: { agentRole: role }
  });
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
