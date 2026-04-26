import type {
  AuditEvent,
  MoreInfoRequest,
  OperationEvent,
  OperationEventType,
  PayerUpdate,
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

export interface PriorAuthStore {
  nowIso(): string;
  transaction<T>(operation: () => T): T;
  close?(): void;
  saveEvaluation(request: RequirementEvaluationRequest, result: RequirementEvaluationResult): RequirementEvaluationResult;
  createWorkItem(input: WorkItemCreateRequest): WorkItem;
  getWorkItem(id: string): WorkItem | null;
  getRequirementRun(evaluationId: string): RequirementRun | null;
  updateWorkItemStatus(
    id: string,
    status: WorkItem["status"],
    actor?: string,
    causedBy?: string,
    packetId?: string,
    receiptId?: string
  ): WorkItem;
  getQuestionnaireSession(id: string): QuestionnaireSession | null;
  saveQuestionnaireSession(session: QuestionnaireSession, actor?: string): QuestionnaireSession;
  getQuestionnaireSessionsForWorkItem(workItemId: string): QuestionnaireSession[];
  getSubmissionPacket(packetId: string): SubmissionPacket | null;
  findSubmissionPacketBySnapshot(snapshot: SubmissionPacket["snapshot"]): SubmissionPacket | null;
  saveSubmissionPacket(packet: SubmissionPacket, actor?: string): SubmissionPacket;
  getSubmissionReceiptByPacketId(packetId: string): SubmissionReceipt | null;
  saveSubmissionReceipt(receipt: SubmissionReceipt, actor?: string): SubmissionReceipt;
  listWorkItems(): WorkItem[];
  getSubmissionReceipts(): SubmissionReceipt[];
  getSubmissionPacketsForWorkItem(workItemId: string): SubmissionPacket[];
  getSubmissionReceiptsForWorkItem(workItemId: string): SubmissionReceipt[];
  getLatestSubmissionReceiptForWorkItem(workItemId: string): SubmissionReceipt | null;
  savePayerUpdate(update: Omit<PayerUpdate, "id" | "createdAt"> & { createdAt?: string }): PayerUpdate;
  getPayerUpdatesForWorkItem(workItemId: string): PayerUpdate[];
  getLatestPayerUpdateForWorkItem(workItemId: string): PayerUpdate | null;
  saveMoreInfoRequest(request: Omit<MoreInfoRequest, "id" | "requestedAt"> & { requestedAt?: string }): MoreInfoRequest;
  resolveOpenMoreInfoRequest(workItemId: string, actor?: OperationEvent["actor"]): MoreInfoRequest | null;
  getMoreInfoRequestsForWorkItem(workItemId: string): MoreInfoRequest[];
  recordOperationEvent(
    workItemId: string,
    type: OperationEventType,
    actor: OperationEvent["actor"],
    details: unknown
  ): OperationEvent;
  getOperationEventsForWorkItem(workItemId: string): OperationEvent[];
  getStatusEvents(workItemId: string): StatusEvent[];
  getAuditEventsForWorkItem(workItemId: string): AuditEvent[];
  hasWorkItems(): boolean;
}

export function snapshot<T>(value: T): T {
  return value === null || value === undefined
    ? value
    : JSON.parse(JSON.stringify(value)) as T;
}

export function assertAllowedTransition(from: WorkItem["status"], to: WorkItem["status"]): void {
  const allowed: Record<WorkItem["status"], WorkItem["status"][]> = {
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

  if (!allowed[from].includes(to)) {
    throw new Error(`Invalid work-item status transition: ${from} -> ${to}`);
  }
}
