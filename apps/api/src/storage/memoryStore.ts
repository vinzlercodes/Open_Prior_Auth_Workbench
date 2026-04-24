import type {
  QuestionnaireSession,
  RequirementEvaluationRequest,
  RequirementEvaluationResult,
  WorkItem,
  WorkItemCreateRequest
} from "@open-prior-auth/shared-types";

export interface RequirementRun {
  request: RequirementEvaluationRequest;
  result: RequirementEvaluationResult;
  createdAt: string;
}

interface AuditEvent {
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  payload: unknown;
}

export class MemoryStore {
  private readonly requirementRuns = new Map<string, RequirementRun>();
  private readonly workItems = new Map<string, WorkItem>();
  private readonly questionnaireSessions = new Map<string, QuestionnaireSession>();
  private readonly auditLog: AuditEvent[] = [];

  saveEvaluation(request: RequirementEvaluationRequest, result: RequirementEvaluationResult): RequirementEvaluationResult {
    this.requirementRuns.set(result.evaluationId, {
      request,
      result,
      createdAt: new Date().toISOString()
    });
    this.audit("system", "requirement_run.saved", "RequirementRun", result.evaluationId, { request, result });
    return result;
  }

  createWorkItem(input: WorkItemCreateRequest): WorkItem {
    const run = this.requirementRuns.get(input.evaluationId);
    if (!run) {
      throw new Error(`Unknown evaluationId: ${input.evaluationId}`);
    }

    const existing = [...this.workItems.values()].find((item) => item.evaluationId === input.evaluationId);
    if (existing) {
      return existing;
    }

    const status = run.result.evaluationStatus === "requirements_found"
      ? "requirements_found"
      : run.result.evaluationStatus === "needs_baseline_data"
        ? "needs_baseline_data"
        : run.result.evaluationStatus === "not_required"
          ? "not_required"
          : "draft";
    const id = `wi-${input.evaluationId.replace(/^eval-/, "").slice(0, 12)}`;
    const workItem: WorkItem = {
      id,
      evaluationId: input.evaluationId,
      patientId: run.request.patientId,
      coverageId: run.request.coverageId,
      requestResourceType: run.request.requestResourceType,
      requestResourceId: run.request.requestResourceId,
      serviceLine: run.request.serviceLine,
      payerId: run.request.payerId,
      ownerUserId: input.ownerUserId ?? null,
      status,
      createdAt: new Date().toISOString(),
      requirementResult: run.result
    };

    this.workItems.set(workItem.id, workItem);
    this.audit(input.ownerUserId ?? "system", "work_item.created", "WorkItem", workItem.id, workItem);
    return workItem;
  }

  getWorkItem(id: string): WorkItem | null {
    return this.workItems.get(id) ?? null;
  }

  getRequirementRun(evaluationId: string): RequirementRun | null {
    return this.requirementRuns.get(evaluationId) ?? null;
  }

  updateWorkItemStatus(id: string, status: WorkItem["status"], actor = "system"): WorkItem {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      throw new Error(`Unknown work item: ${id}`);
    }

    const updated = {
      ...workItem,
      status
    };
    this.workItems.set(id, updated);
    this.audit(actor, "work_item.status_updated", "WorkItem", id, { status });
    return updated;
  }

  getQuestionnaireSession(id: string): QuestionnaireSession | null {
    return this.questionnaireSessions.get(id) ?? null;
  }

  saveQuestionnaireSession(session: QuestionnaireSession, actor = "system"): QuestionnaireSession {
    this.questionnaireSessions.set(session.id, session);
    this.audit(actor, "questionnaire_session.saved", "QuestionnaireSession", session.id, session);
    return session;
  }

  hasWorkItems(): boolean {
    return this.workItems.size > 0;
  }

  private audit(actor: string, action: string, resourceType: string, resourceId: string, payload: unknown): void {
    this.auditLog.push({
      actor,
      action,
      resourceType,
      resourceId,
      timestamp: new Date().toISOString(),
      payload
    });
  }
}
