import type {
  AuditEvent,
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

export class MemoryStore {
  private readonly requirementRuns = new Map<string, RequirementRun>();
  private readonly workItems = new Map<string, WorkItem>();
  private readonly questionnaireSessions = new Map<string, QuestionnaireSession>();
  private readonly submissionPackets = new Map<string, SubmissionPacket>();
  private readonly submissionReceipts = new Map<string, SubmissionReceipt>();
  private readonly statusEvents: StatusEvent[] = [];
  private readonly auditLog: AuditEvent[] = [];
  private statusEventCounter = 0;
  private auditEventCounter = 0;

  saveEvaluation(request: RequirementEvaluationRequest, result: RequirementEvaluationResult): RequirementEvaluationResult {
    const run = {
      request,
      result,
      createdAt: new Date().toISOString()
    };
    this.requirementRuns.set(result.evaluationId, run);
    this.audit("system", "requirement_run.saved", "RequirementRun", result.evaluationId, null, run);
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
    this.audit(input.ownerUserId ?? "system", "work_item.created", "WorkItem", workItem.id, null, workItem, {
      workItemId: workItem.id
    });
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
    this.audit(actor, causedBy, "WorkItem", id, workItem, updated, {
      workItemId: id,
      packetId,
      receiptId
    });
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
    const previous = this.questionnaireSessions.get(session.id) ?? null;
    this.questionnaireSessions.set(session.id, session);
    this.audit(actor, "questionnaire_session.saved", "QuestionnaireSession", session.id, previous, session, {
      workItemId: session.workItemId
    });
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
    const previous = this.submissionPackets.get(packet.id) ?? null;
    this.submissionPackets.set(packet.id, packet);
    this.audit(actor, "submission_packet.saved", "SubmissionPacket", packet.id, previous, packet, {
      workItemId: packet.workItemId,
      packetId: packet.id
    });
    return packet;
  }

  getSubmissionReceiptByPacketId(packetId: string): SubmissionReceipt | null {
    return [...this.submissionReceipts.values()].find((receipt) => receipt.packetId === packetId) ?? null;
  }

  saveSubmissionReceipt(receipt: SubmissionReceipt, actor = "system"): SubmissionReceipt {
    const previous = this.submissionReceipts.get(receipt.receiptId) ?? null;
    const packet = this.submissionPackets.get(receipt.packetId);
    if (!packet) {
      throw new Error(`Unknown submission packet for receipt audit linkage: ${receipt.packetId}`);
    }

    this.submissionReceipts.set(receipt.receiptId, receipt);
    this.audit(actor, "submission_receipt.saved", "SubmissionReceipt", receipt.receiptId, previous, receipt, {
      workItemId: packet.workItemId,
      packetId: receipt.packetId,
      receiptId: receipt.receiptId
    });
    return receipt;
  }

  getStatusEvents(workItemId: string): StatusEvent[] {
    return this.statusEvents.filter((event) => event.workItemId === workItemId);
  }

  getAuditEventsForWorkItem(workItemId: string): AuditEvent[] {
    return this.auditLog
      .filter((event) => event.workItemId === workItemId)
      .sort((first, second) => first.sequence - second.sequence)
      .map((event) => snapshot(event));
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

  private audit(
    actor: string,
    action: string,
    resourceType: string,
    resourceId: string,
    beforeJson: unknown | null,
    afterJson: unknown | null,
    links: Pick<AuditEvent, "workItemId" | "packetId" | "receiptId"> = {}
  ): void {
    this.auditEventCounter += 1;
    this.auditLog.push({
      eventId: `ae-${String(this.auditEventCounter).padStart(6, "0")}`,
      sequence: this.auditEventCounter,
      actor,
      action,
      resourceType,
      resourceId,
      timestamp: new Date().toISOString(),
      beforeJson: snapshot(beforeJson),
      afterJson: snapshot(afterJson),
      ...links
    });
  }
}

function snapshot<T>(value: T): T {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value)) as T;
}
