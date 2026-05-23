import type {
  AuditEvent,
  EvidenceListResponse,
  PacketBuildRequest,
  PacketSubmitRequest,
  QuestionnairePackage,
  QuestionnaireResponseSaveRequest,
  RequirementEvaluationRequest,
  RequirementEvaluationResult,
  StatusEvent,
  WorkItemQueueQuery,
  WorkItemQueueRow
} from "@open-prior-auth/shared-types";
import type {
  PayerDetermination,
  PriorAuthorizationCase,
  PriorAuthorizationRequest,
  PriorAuthorizationRequestStatus
} from "./domain.js";
import { OperationOutcomeError } from "./errors.js";
import { evaluateRequirement } from "./evaluation/evaluate.js";
import { EvidenceRepository } from "./evidence/evidenceRepository.js";
import { OperationsService } from "./operations/operationsService.js";
import type { ClinicalContextRepository } from "./ports.js";
import { QuestionnaireService } from "./questionnaires/questionnaireService.js";
import type { PriorAuthStore } from "./storage/priorAuthStore.js";
import { SubmissionService } from "./submissions/submissionService.js";

export function evaluateRequirements(
  input: RequirementEvaluationRequest,
  repository: ClinicalContextRepository,
  store?: PriorAuthStore
): RequirementEvaluationResult {
  const result = evaluateRequirement(input, repository);
  return store ? store.saveEvaluation(input, result) : result;
}

export function getPriorAuthorizationCase(workItemId: string, store: PriorAuthStore): PriorAuthorizationCase {
  const workItem = requireWorkItem(workItemId, store);
  const submissionPackets = store.getSubmissionPacketsForWorkItem(workItem.id);
  const submissionReceipts = store.getSubmissionReceiptsForWorkItem(workItem.id);
  const payerUpdates = store.getPayerUpdatesForWorkItem(workItem.id);
  const latestPacket = submissionPackets.at(-1);
  const latestReceipt = submissionReceipts.at(-1);
  const latestFinalUpdate = [...payerUpdates].reverse().find((update) =>
    update.status === "approved" || update.status === "denied" || update.status === "cancelled"
  );

  return {
    id: workItem.id,
    lifecycleStatus: workItem.status,
    workItem,
    currentRequest: {
      id: `par-${workItem.id}`,
      caseId: workItem.id,
      workItemId: workItem.id,
      requestStatus: requestStatusFor(workItem.status),
      payerId: workItem.payerId,
      coverageId: workItem.coverageId,
      requestResourceType: workItem.requestResourceType,
      requestResourceId: workItem.requestResourceId,
      latestSubmissionPacketId: latestPacket?.id,
      latestReceiptId: latestReceipt?.receiptId,
      trackingId: latestReceipt?.trackingId
    },
    submissionPackets,
    submissionReceipts,
    payerUpdates,
    payerDetermination: latestFinalUpdate ? toPayerDetermination(workItem.id, latestFinalUpdate) : null,
    statusTimeline: store.getStatusEvents(workItem.id),
    auditTrace: store.getAuditEventsForWorkItem(workItem.id)
  };
}

export function listWorkItems(store: PriorAuthStore, query: WorkItemQueueQuery = {}): WorkItemQueueRow[] {
  return new OperationsService(store).listQueue(query);
}

export function getQuestionnairePackage(
  input: { workItemId: string },
  repository: ClinicalContextRepository,
  store: PriorAuthStore
): QuestionnairePackage {
  return new QuestionnaireService(repository, store).getPackage(input.workItemId);
}

export function saveQuestionnaireResponse(
  input: QuestionnaireResponseSaveRequest,
  repository: ClinicalContextRepository,
  store: PriorAuthStore
): QuestionnairePackage {
  return new QuestionnaireService(repository, store).saveResponse(input);
}

export function listEvidence(
  workItemId: string,
  store: PriorAuthStore,
  uploadDirectory?: string
): EvidenceListResponse {
  return new EvidenceRepository(store, uploadDirectory).listEvidenceForWorkItem(workItemId);
}

export function buildSubmissionPacket(
  input: PacketBuildRequest,
  repository: ClinicalContextRepository,
  store: PriorAuthStore
) {
  return new SubmissionService(repository, store).buildPacket(input);
}

export function submitMockPacket(
  input: PacketSubmitRequest,
  repository: ClinicalContextRepository,
  store: PriorAuthStore
) {
  return new SubmissionService(repository, store).submitPacket(input);
}

export function getCaseStatusTimeline(workItemId: string, store: PriorAuthStore): StatusEvent[] {
  requireWorkItem(workItemId, store);
  return store.getStatusEvents(workItemId);
}

export function getCaseAuditTrace(workItemId: string, store: PriorAuthStore): AuditEvent[] {
  requireWorkItem(workItemId, store);
  return store.getAuditEventsForWorkItem(workItemId);
}

function requireWorkItem(workItemId: string, store: PriorAuthStore) {
  const workItem = store.getWorkItem(workItemId);
  if (!workItem) {
    throw new OperationOutcomeError(404, "not-found", `Work item not found: ${workItemId}`);
  }
  return workItem;
}

function requestStatusFor(status: PriorAuthorizationCase["lifecycleStatus"]): PriorAuthorizationRequestStatus {
  if (status === "approved" || status === "denied" || status === "cancelled" || status === "not_required") {
    return "closed";
  }
  if (status === "packet_ready" || status === "submission_failed") {
    return "packet_ready";
  }
  if (status === "submitted") {
    return "submitted";
  }
  if (status === "more_info_needed") {
    return "more_info_needed";
  }
  if (status === "questionnaire_in_progress" || status === "review_ready") {
    return "questionnaire_in_progress";
  }
  if (status === "requirements_found" || status === "needs_baseline_data") {
    return "requirements_found";
  }
  return "draft";
}

function toPayerDetermination(caseId: string, update: PayerDetermination["payerUpdate"]): PayerDetermination {
  return {
    id: `pd-${update.id}`,
    caseId,
    workItemId: update.workItemId,
    status: update.status as PayerDetermination["status"],
    decidedAt: update.decidedAt ?? update.createdAt,
    payerUpdate: update
  };
}
