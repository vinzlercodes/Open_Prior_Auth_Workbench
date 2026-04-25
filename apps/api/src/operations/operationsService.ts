import type {
  DenialReason,
  EffectiveOperationsStatus,
  MoreInfoRequest,
  MoreInfoRequestCreateRequest,
  OperationsMetrics,
  PayerStatusRecordRequest,
  PayerUpdate,
  WorkItem,
  WorkItemOperationsHistory,
  WorkItemQueueQuery,
  WorkItemQueueRow
} from "@open-prior-auth/shared-types";
import { OperationOutcomeError } from "../errors.js";
import { type MemoryStore } from "../storage/memoryStore.js";

const TERMINAL_STATUSES: WorkItem["status"][] = ["approved", "denied", "cancelled", "not_required"];

export class OperationsService {
  constructor(private readonly store: MemoryStore) {}

  listQueue(query: WorkItemQueueQuery = {}): WorkItemQueueRow[] {
    const statusFilter = parseCsv(query.status);
    const rows = this.store.listWorkItems().map((workItem) => this.toQueueRow(workItem));
    const filtered = rows.filter((row) => {
      const statusMatches = statusFilter.length === 0 || statusFilter.includes(row.effectiveStatus);
      const ownerMatches = !query.owner
        || (query.owner === "unassigned" ? row.ownerUserId === null : row.ownerUserId === query.owner);
      return statusMatches && ownerMatches;
    });

    return sortRows(filtered, query.sort ?? "age_desc");
  }

  getMetrics(): OperationsMetrics {
    const generatedAt = this.store.nowIso();
    const rows = this.store.listWorkItems().map((workItem) => this.toQueueRow(workItem));
    const submittedRows = rows.filter((row) => row.submittedAt);
    const payerUpdates = rows
      .map((row) => row.latestPayerUpdate)
      .filter((update): update is PayerUpdate => Boolean(update));
    const decisionTimes = payerUpdates
      .map((update) => update.decisionTimeMs)
      .filter((value): value is number => typeof value === "number");
    const statusEventsByWorkItem = new Map(rows.map((row) => [
      row.workItemId,
      this.store.getStatusEvents(row.workItemId)
    ]));
    const reviewReadyTimes = rows
      .map((row) => {
        const event = statusEventsByWorkItem.get(row.workItemId)?.find((candidate) => candidate.toStatus === "review_ready");
        return event ? Date.parse(event.at) - Date.parse(row.createdAt) : null;
      })
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    const submittedCount = submittedRows.length;
    const pendedCount = rows.filter((row) => row.effectiveStatus === "pended").length;
    const moreInfoCount = rows.filter((row) => this.store.getMoreInfoRequestsForWorkItem(row.workItemId).length > 0).length;
    const approvedCount = rows.filter((row) => row.status === "approved").length;
    const deniedCount = rows.filter((row) => row.status === "denied").length;

    return {
      generatedAt,
      totalWorkItems: rows.length,
      openWorkItems: rows.filter((row) => !TERMINAL_STATUSES.includes(row.status)).length,
      terminalWorkItems: rows.filter((row) => TERMINAL_STATUSES.includes(row.status)).length,
      countsByStatus: countBy(rows, (row) => row.status),
      countsByEffectiveStatus: countBy(rows, (row) => row.effectiveStatus),
      agingBuckets: {
        under1Hour: rows.filter((row) => row.ageMs < 60 * 60 * 1000).length,
        oneTo24Hours: rows.filter((row) => row.ageMs >= 60 * 60 * 1000 && row.ageMs < 24 * 60 * 60 * 1000).length,
        over24Hours: rows.filter((row) => row.ageMs >= 24 * 60 * 60 * 1000).length
      },
      medianTimeToReviewReadyMs: median(reviewReadyTimes),
      submittedCount,
      moreInfoCount,
      deniedCount,
      averageSubmissionToDecisionMs: average(decisionTimes),
      medianSubmissionToDecisionMs: median(decisionTimes),
      approvalRate: rate(approvedCount, submittedCount),
      denialRate: rate(deniedCount, submittedCount),
      moreInfoRate: rate(moreInfoCount, submittedCount),
      pendedRate: rate(pendedCount, submittedCount),
      standardVsExpeditedBreakdown: this.standardVsExpeditedBreakdown(rows)
    };
  }

  getOperationsHistory(workItemId: string): WorkItemOperationsHistory {
    this.requireWorkItem(workItemId);
    return {
      workItemId,
      payerUpdates: this.store.getPayerUpdatesForWorkItem(workItemId),
      moreInfoRequests: this.store.getMoreInfoRequestsForWorkItem(workItemId),
      operationEvents: this.store.getOperationEventsForWorkItem(workItemId)
    };
  }

  requestMoreInfo(workItemId: string, input: MoreInfoRequestCreateRequest): MoreInfoRequest {
    const workItem = this.requireWorkItem(workItemId);
    if (TERMINAL_STATUSES.includes(workItem.status)) {
      throw new OperationOutcomeError(
        409,
        "conflict",
        `Work item ${workItem.id} is terminal and cannot receive a more-info request. Current status: ${workItem.status}.`
      );
    }
    if (workItem.status !== "submitted") {
      throw new OperationOutcomeError(
        409,
        "conflict",
        `Work item ${workItem.id} must be submitted or payer-pended before requesting more information. Current status: ${workItem.status}.`
      );
    }
    if (!input.message || !Array.isArray(input.requestedItems) || input.requestedItems.length === 0) {
      throw new OperationOutcomeError(400, "required", "message and at least one requested item are required.");
    }

    const request = this.store.saveMoreInfoRequest({
      workItemId,
      message: input.message,
      requestedItems: input.requestedItems,
      dueAt: input.dueAt
    });
    this.store.updateWorkItemStatus(workItemId, "more_info_needed", input.actor ?? "mock-payer", "more_info.requested");
    this.store.recordOperationEvent(workItemId, "more_info_requested", input.actor ?? "mock-payer", request);
    return request;
  }

  recordPayerStatus(workItemId: string, input: PayerStatusRecordRequest): PayerUpdate {
    const workItem = this.requireWorkItem(workItemId);
    const actor = input.actor ?? "mock-payer";
    if (TERMINAL_STATUSES.includes(workItem.status)) {
      throw new OperationOutcomeError(
        409,
        "conflict",
        `Work item ${workItem.id} is terminal and cannot accept payer updates. Current status: ${workItem.status}.`
      );
    }
    if (workItem.status !== "submitted") {
      throw new OperationOutcomeError(
        409,
        "conflict",
        `Work item ${workItem.id} must be submitted before recording payer status. Current status: ${workItem.status}.`
      );
    }
    if (input.status === "denied" && !input.reason) {
      throw new OperationOutcomeError(400, "required", "A structured denial reason is required for denied payer updates.");
    }

    const receipt = this.store.getLatestSubmissionReceiptForWorkItem(workItemId);
    if (!receipt) {
      throw new OperationOutcomeError(409, "conflict", `Work item ${workItem.id} has no submitted packet receipt.`);
    }

    const createdAt = this.store.nowIso();
    const decidedAt = input.status === "pended" ? undefined : createdAt;
    const submittedAt = receipt.submittedAt;
    const update = this.store.savePayerUpdate({
      workItemId,
      status: input.status,
      actor,
      createdAt,
      submittedAt,
      decidedAt,
      decisionTimeMs: decidedAt ? Date.parse(decidedAt) - Date.parse(submittedAt) : undefined,
      reason: input.reason ? normalizeDenialReason(input.reason) : undefined,
      message: input.message
    });

    this.store.recordOperationEvent(workItemId, "payer_status_recorded", actor, update);
    if (input.status !== "pended") {
      this.store.updateWorkItemStatus(workItemId, input.status, actor, `payer_status.${input.status}`);
      if (input.status === "cancelled") {
        this.store.recordOperationEvent(workItemId, "case_cancelled", actor, update);
      }
    }

    return update;
  }

  private toQueueRow(workItem: WorkItem): WorkItemQueueRow {
    const statusEvents = this.store.getStatusEvents(workItem.id);
    const lastTransition = statusEvents.at(-1);
    const latestPayerUpdate = this.store.getLatestPayerUpdateForWorkItem(workItem.id) ?? undefined;
    const moreInfoRequests = this.store.getMoreInfoRequestsForWorkItem(workItem.id);
    const latestMoreInfoRequest = moreInfoRequests.at(-1);
    const receipt = this.store.getLatestSubmissionReceiptForWorkItem(workItem.id);
    const effectiveStatus: EffectiveOperationsStatus =
      latestPayerUpdate?.status === "pended" && workItem.status === "submitted"
        ? "pended"
        : workItem.status;
    const now = Date.parse(this.store.nowIso());
    const lastTransitionAt = lastTransition?.at ?? workItem.createdAt;

    return {
      workItemId: workItem.id,
      patientName: workItem.requirementResult.requestSummary.patientName,
      payerName: workItem.requirementResult.requestSummary.payerName,
      serviceDescription: workItem.requirementResult.requestSummary.serviceDescription,
      ownerUserId: workItem.ownerUserId,
      status: workItem.status,
      effectiveStatus,
      createdAt: workItem.createdAt,
      ageMs: Math.max(0, now - Date.parse(workItem.createdAt)),
      lastTransitionAt,
      lastTransitionAgeMs: Math.max(0, now - Date.parse(lastTransitionAt)),
      submittedAt: receipt?.submittedAt,
      decidedAt: latestPayerUpdate?.decidedAt,
      decisionTimeMs: latestPayerUpdate?.decisionTimeMs,
      latestPayerUpdate,
      latestMoreInfoRequest,
      nextAction: nextActionFor(effectiveStatus)
    };
  }

  private requireWorkItem(workItemId: string): WorkItem {
    const workItem = this.store.getWorkItem(workItemId);
    if (!workItem) {
      throw new OperationOutcomeError(404, "not-found", `Work item not found: ${workItemId}`);
    }
    return workItem;
  }

  private standardVsExpeditedBreakdown(rows: WorkItemQueueRow[]): OperationsMetrics["standardVsExpeditedBreakdown"] {
    const timesByBucket = new Map<string, number[]>();
    const countsByBucket = new Map<string, { submitted: number; decided: number }>();
    for (const row of rows.filter((candidate) => candidate.submittedAt)) {
      const urgency = clinicalUrgencyFor(this.store, row.workItemId);
      const key = urgency === "urgent" ? "expedited" : urgency === "routine" ? "standard" : "unknown";
      const counts = countsByBucket.get(key) ?? { submitted: 0, decided: 0 };
      countsByBucket.set(key, {
        submitted: counts.submitted + 1,
        decided: counts.decided + (typeof row.decisionTimeMs === "number" ? 1 : 0)
      });
      if (typeof row.decisionTimeMs === "number") {
        timesByBucket.set(key, [...(timesByBucket.get(key) ?? []), row.decisionTimeMs]);
      }
    }

    const buckets: NonNullable<OperationsMetrics["standardVsExpeditedBreakdown"]> = {};
    for (const [key, counts] of countsByBucket) {
      const times = timesByBucket.get(key) ?? [];
      buckets[key] = {
        submitted: counts.submitted,
        decided: counts.decided,
        averageSubmissionToDecisionMs: average(times),
        medianSubmissionToDecisionMs: median(times)
      };
    }
    return Object.keys(buckets).length > 0 ? buckets : undefined;
  }
}

function parseCsv(value: string | undefined): string[] {
  return value ? value.split(",").map((item) => item.trim()).filter(Boolean) : [];
}

function sortRows(rows: WorkItemQueueRow[], sort: NonNullable<WorkItemQueueQuery["sort"]>): WorkItemQueueRow[] {
  return [...rows].sort((first, second) => {
    const tie = first.createdAt.localeCompare(second.createdAt) || first.workItemId.localeCompare(second.workItemId);
    if (sort === "age_asc") {
      return first.ageMs - second.ageMs || tie;
    }
    if (sort === "updated_desc") {
      return second.lastTransitionAt.localeCompare(first.lastTransitionAt) || tie;
    }
    if (sort === "updated_asc") {
      return first.lastTransitionAt.localeCompare(second.lastTransitionAt) || tie;
    }
    return second.ageMs - first.ageMs || tie;
  });
}

function normalizeDenialReason(reason: PayerStatusRecordRequest["reason"]): DenialReason {
  if (!reason?.code || !reason.display || !reason.detail) {
    throw new OperationOutcomeError(400, "required", "Denial reason requires code, display, and detail.");
  }
  return {
    code: reason.code,
    display: reason.display,
    detail: reason.detail,
    source: "mock-payer"
  };
}

function countBy<T>(items: T[], keyFor: (item: T) => string): Record<string, number> {
  return items.reduce<Record<string, number>>((counts, item) => {
    const key = keyFor(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function average(values: number[]): number | null {
  return values.length === 0
    ? null
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function rate(count: number, denominator: number): number {
  return denominator === 0 ? 0 : count / denominator;
}

function nextActionFor(status: EffectiveOperationsStatus): string {
  const byStatus: Record<EffectiveOperationsStatus, string> = {
    draft: "evaluate requirements",
    requirements_found: "open questionnaire",
    not_required: "no prior authorization needed",
    needs_baseline_data: "collect baseline data",
    questionnaire_in_progress: "complete questionnaire",
    review_ready: "build packet",
    packet_ready: "submit packet",
    submitted: "await payer response",
    pended: "await payer determination",
    more_info_needed: "resolve more-info request",
    approved: "close approved case",
    denied: "review denial reason",
    cancelled: "case closed",
    submission_failed: "retry submission"
  };
  return byStatus[status];
}

function clinicalUrgencyFor(store: MemoryStore, workItemId: string): string | null {
  const session = store.getQuestionnaireSessionsForWorkItem(workItemId).at(-1);
  const item = session?.questionnaireResponse.item.find((candidate) => candidate.linkId === "clinical-urgency");
  return item?.answer?.[0]?.valueCoding?.code ?? null;
}
