import type {
  QuestionnaireSession,
  RequirementEvaluationRequest,
  RequirementEvaluationResult,
  StatusEvent,
  SubmissionPacket,
  SubmissionReceipt,
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
  private readonly submissionPackets = new Map<string, SubmissionPacket>();
  private readonly submissionReceipts = new Map<string, SubmissionReceipt>();
  private readonly statusEvents: StatusEvent[] = [];
  private readonly auditLog: AuditEvent[] = [];
  private statusEventCounter = 0;

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
    this.recordStatusEvent({
      workItemId: workItem.id,
      fromStatus: null,
      toStatus: workItem.status,
      actor: input.ownerUserId ?? "system",
      causedBy: "work_item.created"
    });
    return workItem;
  }

  getWorkItem(id: string): WorkItem | null {
    return this.workItems.get(id) ?? null;
  }

  getRequirementRun(evaluationId: string): RequirementRun | null {
    return this.requirementRuns.get(evaluationId) ?? null;
  }

  updateWorkItemStatus(
    id: string,
    status: WorkItem["status"],
    actor = "system",
    causedBy = "work_item.status_updated",
    packetId?: string,
    receiptId?: string
  ): WorkItem {
    const workItem = this.workItems.get(id);
    if (!workItem) {
      throw new Error(`Unknown work item: ${id}`);
    }

    if (workItem.status === status) {
      return workItem;
    }

    const updated = {
      ...workItem,
      status
    };
    this.workItems.set(id, updated);
    this.audit(actor, causedBy, "WorkItem", id, { status, packetId, receiptId });
    this.recordStatusEvent({
      workItemId: id,
      fromStatus: workItem.status,
      toStatus: status,
      actor,
      causedBy,
      packetId,
      receiptId
    });
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

  getQuestionnaireSessionsForWorkItem(workItemId: string): QuestionnaireSession[] {
    return [...this.questionnaireSessions.values()].filter((session) => session.workItemId === workItemId);
  }

  getSubmissionPacket(packetId: string): SubmissionPacket | null {
    return this.submissionPackets.get(packetId) ?? null;
  }

  findSubmissionPacketBySnapshot(snapshot: SubmissionPacket["snapshot"]): SubmissionPacket | null {
    return [...this.submissionPackets.values()].find((packet) =>
      packet.snapshot.workItemId === snapshot.workItemId
      && packet.snapshot.questionnaireResponseId === snapshot.questionnaireResponseId
      && packet.snapshot.questionnaireResponseRevision === snapshot.questionnaireResponseRevision
      && packet.snapshot.payerId === snapshot.payerId
      && packet.snapshot.packetSchemaVersion === snapshot.packetSchemaVersion
    ) ?? null;
  }

  saveSubmissionPacket(packet: SubmissionPacket, actor = "system"): SubmissionPacket {
    this.submissionPackets.set(packet.id, packet);
    this.audit(actor, "submission_packet.saved", "SubmissionPacket", packet.id, packet);
    return packet;
  }

  getSubmissionReceiptByPacketId(packetId: string): SubmissionReceipt | null {
    return [...this.submissionReceipts.values()].find((receipt) => receipt.packetId === packetId) ?? null;
  }

  saveSubmissionReceipt(receipt: SubmissionReceipt, actor = "system"): SubmissionReceipt {
    this.submissionReceipts.set(receipt.receiptId, receipt);
    this.audit(actor, "submission_receipt.saved", "SubmissionReceipt", receipt.receiptId, receipt);
    return receipt;
  }

  getStatusEvents(workItemId: string): StatusEvent[] {
    return this.statusEvents.filter((event) => event.workItemId === workItemId);
  }

  hasWorkItems(): boolean {
    return this.workItems.size > 0;
  }

  private recordStatusEvent(input: Omit<StatusEvent, "eventId" | "at">): void {
    this.statusEventCounter += 1;
    this.statusEvents.push({
      ...input,
      eventId: `se-${String(this.statusEventCounter).padStart(6, "0")}`,
      at: new Date().toISOString()
    });
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
