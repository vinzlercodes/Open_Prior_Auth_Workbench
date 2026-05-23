import type {
  AuditEvent,
  PayerUpdate,
  StatusEvent,
  SubmissionPacket,
  SubmissionReceipt,
  WorkItem
} from "@open-prior-auth/shared-types";

export type PriorAuthorizationCaseId = string;
export type PriorAuthorizationRequestId = string;
export type SubmissionPacketId = string;
export type PayerUpdateId = string;
export type PayerDeterminationId = string;
export type WorkItemId = string;

export type PriorAuthorizationRequestStatus =
  | "draft"
  | "requirements_found"
  | "questionnaire_in_progress"
  | "packet_ready"
  | "submitted"
  | "more_info_needed"
  | "closed";

export interface PriorAuthorizationRequest {
  id: PriorAuthorizationRequestId;
  caseId: PriorAuthorizationCaseId;
  workItemId: WorkItemId;
  requestStatus: PriorAuthorizationRequestStatus;
  payerId: string;
  coverageId: string;
  requestResourceType: WorkItem["requestResourceType"];
  requestResourceId: string;
  latestSubmissionPacketId?: SubmissionPacketId;
  latestReceiptId?: string;
  trackingId?: string;
}

export interface PayerDetermination {
  id: PayerDeterminationId;
  caseId: PriorAuthorizationCaseId;
  workItemId: WorkItemId;
  status: "approved" | "denied" | "cancelled";
  decidedAt: string;
  payerUpdate: PayerUpdate;
}

export interface PriorAuthorizationCase {
  id: PriorAuthorizationCaseId;
  lifecycleStatus: WorkItem["status"];
  workItem: WorkItem;
  currentRequest: PriorAuthorizationRequest;
  submissionPackets: SubmissionPacket[];
  submissionReceipts: SubmissionReceipt[];
  payerUpdates: PayerUpdate[];
  payerDetermination: PayerDetermination | null;
  statusTimeline: StatusEvent[];
  auditTrace: AuditEvent[];
}
