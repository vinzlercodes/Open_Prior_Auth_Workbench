import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AuditEvent,
  EvidenceAttachment,
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
import { resolveFromRepoRoot } from "../config/paths.js";
import {
  assertAllowedTransition,
  type PriorAuthStore,
  type RequirementRun,
  snapshot
} from "@open-prior-auth/prior-auth-core";

type Row = Record<string, unknown>;

const SCHEMA_VERSION = 2;

export function defaultDatabasePath(): string {
  return process.env.OPEN_PRIOR_AUTH_DB_PATH ?? resolveFromRepoRoot(".data/open-prior-auth.sqlite");
}

export function resetSqliteDatabase(path = defaultDatabasePath()): void {
  if (path !== ":memory:" && existsSync(path)) {
    rmSync(path);
  }
  const store = new SqliteStore(path);
  store.close();
}

export class SqliteStore implements PriorAuthStore {
  private readonly db: DatabaseSync;
  private transactionDepth = 0;

  constructor(
    private readonly databasePath = defaultDatabasePath(),
    private readonly clock: () => Date = () => new Date()
  ) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    this.db = new DatabaseSync(databasePath, {
      allowBareNamedParameters: true,
      enableForeignKeyConstraints: true,
      readBigInts: false,
      returnArrays: false,
      timeout: 5000
    });
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  nowIso(): string {
    return this.clock().toISOString();
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(operation: () => T): T {
    if (this.transactionDepth > 0) {
      return operation();
    }
    this.db.exec("BEGIN IMMEDIATE;");
    this.transactionDepth = 1;
    try {
      const result = operation();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    } finally {
      this.transactionDepth = 0;
    }
  }

  saveEvaluation(request: RequirementEvaluationRequest, result: RequirementEvaluationResult): RequirementEvaluationResult {
    return this.transaction(() => {
      const createdAt = this.nowIso();
      this.db.prepare(`
        INSERT INTO requirement_runs (evaluation_id, request_json, result_json, created_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(evaluation_id) DO UPDATE SET
          request_json = excluded.request_json,
          result_json = excluded.result_json,
          created_at = excluded.created_at
      `).run(result.evaluationId, encode(request), encode(result), createdAt);
      this.audit("system", "requirement_run.saved", "RequirementRun", result.evaluationId, null, {
        request,
        result,
        createdAt
      });
      return result;
    });
  }

  createWorkItem(input: WorkItemCreateRequest): WorkItem {
    return this.transaction(() => {
      const run = this.getRequirementRun(input.evaluationId);
      if (!run) {
        throw new Error(`Unknown evaluationId: ${input.evaluationId}`);
      }

      const existing = this.getWorkItemByEvaluationId(input.evaluationId);
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
      const workItem: WorkItem = {
        id: `wi-${input.evaluationId.replace(/^eval-/, "").slice(0, 12)}`,
        evaluationId: input.evaluationId,
        patientId: run.request.patientId,
        coverageId: run.request.coverageId,
        requestResourceType: run.request.requestResourceType,
        requestResourceId: run.request.requestResourceId,
        serviceLine: run.request.serviceLine,
        payerId: run.request.payerId,
        ownerUserId: input.ownerUserId ?? null,
        status,
        createdAt: this.nowIso(),
        requirementResult: run.result
      };

      this.insertWorkItem(workItem);
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
    });
  }

  getWorkItem(id: string): WorkItem | null {
    return this.workItemFromRow(this.db.prepare("SELECT * FROM work_items WHERE id = ?").get(id) as Row | undefined);
  }

  getRequirementRun(evaluationId: string): RequirementRun | null {
    const row = this.db.prepare("SELECT * FROM requirement_runs WHERE evaluation_id = ?").get(evaluationId) as Row | undefined;
    if (!row) {
      return null;
    }
    return {
      request: decode(row.request_json),
      result: decode(row.result_json),
      createdAt: text(row.created_at)
    };
  }

  updateWorkItemStatus(
    id: string,
    status: WorkItem["status"],
    actor = "system",
    causedBy = "work_item.status_updated",
    packetId?: string,
    receiptId?: string
  ): WorkItem {
    return this.transaction(() => {
      const workItem = this.getWorkItem(id);
      if (!workItem) {
        throw new Error(`Unknown work item: ${id}`);
      }
      if (workItem.status === status) {
        return workItem;
      }
      assertAllowedTransition(workItem.status, status);
      const updated = { ...workItem, status };
      this.insertWorkItem(updated);
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
    });
  }

  getQuestionnaireSession(id: string): QuestionnaireSession | null {
    return this.questionnaireSessionFromRow(
      this.db.prepare("SELECT * FROM questionnaire_sessions WHERE id = ?").get(id) as Row | undefined
    );
  }

  saveQuestionnaireSession(session: QuestionnaireSession, actor = "system"): QuestionnaireSession {
    return this.transaction(() => {
      const previous = this.getQuestionnaireSession(session.id);
      this.db.prepare(`
        INSERT INTO questionnaire_sessions (
          id, work_item_id, questionnaire_canonical, questionnaire_version, questionnaire_response_json,
          validation_json, status, prefill_overrides_json, created_at, updated_at, revision
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          questionnaire_response_json = excluded.questionnaire_response_json,
          validation_json = excluded.validation_json,
          status = excluded.status,
          prefill_overrides_json = excluded.prefill_overrides_json,
          updated_at = excluded.updated_at,
          revision = excluded.revision
      `).run(
        session.id,
        session.workItemId,
        session.questionnaireCanonical,
        session.questionnaireVersion,
        encode(session.questionnaireResponse),
        encode(session.validation),
        session.status,
        encode(session.prefillOverrides),
        session.createdAt,
        session.updatedAt,
        session.revision
      );
      this.audit(actor, "questionnaire_session.saved", "QuestionnaireSession", session.id, previous, session, {
        workItemId: session.workItemId
      });
      return session;
    });
  }

  getQuestionnaireSessionsForWorkItem(workItemId: string): QuestionnaireSession[] {
    return (this.db.prepare(`
      SELECT * FROM questionnaire_sessions WHERE work_item_id = ? ORDER BY created_at, id
    `).all(workItemId) as Row[]).map((row) => this.questionnaireSessionFromRow(row)).filter(isPresent);
  }

  getSubmissionPacket(packetId: string): SubmissionPacket | null {
    return this.submissionPacketFromRow(
      this.db.prepare("SELECT * FROM submission_packets WHERE id = ?").get(packetId) as Row | undefined
    );
  }

  findSubmissionPacketBySnapshot(snapshotValue: SubmissionPacket["snapshot"]): SubmissionPacket | null {
    return this.submissionPacketFromRow(
      this.db.prepare(`
        SELECT * FROM submission_packets
        WHERE snapshot_work_item_id = ?
          AND snapshot_questionnaire_response_id = ?
          AND snapshot_questionnaire_response_revision = ?
          AND snapshot_payer_id = ?
          AND packet_schema_version = ?
      `).get(
        snapshotValue.workItemId,
        snapshotValue.questionnaireResponseId,
        snapshotValue.questionnaireResponseRevision,
        snapshotValue.payerId,
        snapshotValue.packetSchemaVersion
      ) as Row | undefined
    );
  }

  saveSubmissionPacket(packet: SubmissionPacket, actor = "system"): SubmissionPacket {
    return this.transaction(() => {
      const previous = this.getSubmissionPacket(packet.id);
      this.db.prepare(`
        INSERT INTO submission_packets (
          id, work_item_id, packet_schema_version, built_at, transport, bundle_json,
          attachment_manifest_json, snapshot_json, snapshot_work_item_id,
          snapshot_questionnaire_response_id, snapshot_questionnaire_response_revision, snapshot_payer_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          bundle_json = excluded.bundle_json,
          attachment_manifest_json = excluded.attachment_manifest_json,
          snapshot_json = excluded.snapshot_json
      `).run(
        packet.id,
        packet.workItemId,
        packet.packetSchemaVersion,
        packet.builtAt,
        packet.transport,
        encode(packet.bundle),
        encode(packet.attachmentManifest),
        encode(packet.snapshot),
        packet.snapshot.workItemId,
        packet.snapshot.questionnaireResponseId,
        packet.snapshot.questionnaireResponseRevision,
        packet.snapshot.payerId
      );
      this.audit(actor, "submission_packet.saved", "SubmissionPacket", packet.id, previous, packet, {
        workItemId: packet.workItemId,
        packetId: packet.id
      });
      return packet;
    });
  }

  getSubmissionReceiptByPacketId(packetId: string): SubmissionReceipt | null {
    return this.submissionReceiptFromRow(
      this.db.prepare("SELECT * FROM submission_receipts WHERE packet_id = ?").get(packetId) as Row | undefined
    );
  }

  saveSubmissionReceipt(receipt: SubmissionReceipt, actor = "system"): SubmissionReceipt {
    return this.transaction(() => {
      const previous = this.submissionReceiptFromRow(
        this.db.prepare("SELECT * FROM submission_receipts WHERE receipt_id = ?").get(receipt.receiptId) as Row | undefined
      );
      const packet = this.getSubmissionPacket(receipt.packetId);
      if (!packet) {
        throw new Error(`Unknown submission packet for receipt audit linkage: ${receipt.packetId}`);
      }
      this.db.prepare(`
        INSERT INTO submission_receipts (
          receipt_id, packet_id, tracking_id, submitted_at, transport, idempotent, response_bundle_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(receipt_id) DO UPDATE SET
          tracking_id = excluded.tracking_id,
          submitted_at = excluded.submitted_at,
          idempotent = excluded.idempotent,
          response_bundle_json = excluded.response_bundle_json
      `).run(
        receipt.receiptId,
        receipt.packetId,
        receipt.trackingId,
        receipt.submittedAt,
        receipt.transport,
        receipt.idempotent ? 1 : 0,
        encode(receipt.responseBundle)
      );
      this.audit(actor, "submission_receipt.saved", "SubmissionReceipt", receipt.receiptId, previous, receipt, {
        workItemId: packet.workItemId,
        packetId: receipt.packetId,
        receiptId: receipt.receiptId
      });
      return receipt;
    });
  }

  listWorkItems(): WorkItem[] {
    return (this.db.prepare("SELECT * FROM work_items ORDER BY created_at, id").all() as Row[])
      .map((row) => this.workItemFromRow(row))
      .filter(isPresent);
  }

  getSubmissionReceipts(): SubmissionReceipt[] {
    return (this.db.prepare("SELECT * FROM submission_receipts ORDER BY submitted_at, receipt_id").all() as Row[])
      .map((row) => this.submissionReceiptFromRow(row))
      .filter(isPresent);
  }

  getSubmissionPacketsForWorkItem(workItemId: string): SubmissionPacket[] {
    return (this.db.prepare("SELECT * FROM submission_packets WHERE work_item_id = ? ORDER BY built_at, id").all(workItemId) as Row[])
      .map((row) => this.submissionPacketFromRow(row))
      .filter(isPresent);
  }

  getSubmissionReceiptsForWorkItem(workItemId: string): SubmissionReceipt[] {
    const packetIds = new Set(this.getSubmissionPacketsForWorkItem(workItemId).map((packet) => packet.id));
    return this.getSubmissionReceipts()
      .filter((receipt) => packetIds.has(receipt.packetId))
      .sort((first, second) => first.submittedAt.localeCompare(second.submittedAt));
  }

  getLatestSubmissionReceiptForWorkItem(workItemId: string): SubmissionReceipt | null {
    return this.getSubmissionReceiptsForWorkItem(workItemId).at(-1) ?? null;
  }

  savePayerUpdate(update: Omit<PayerUpdate, "id" | "createdAt"> & { createdAt?: string }): PayerUpdate {
    return this.transaction(() => {
      const saved: PayerUpdate = {
        ...update,
        id: this.nextPrefixedId("payer_updates", "id", "pu"),
        createdAt: update.createdAt ?? this.nowIso()
      };
      this.db.prepare(`
        INSERT INTO payer_updates (
          id, work_item_id, status, actor, created_at, submitted_at, decided_at,
          decision_time_ms, reason_json, message
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        saved.id,
        saved.workItemId,
        saved.status,
        saved.actor,
        saved.createdAt,
        saved.submittedAt,
        saved.decidedAt ?? null,
        saved.decisionTimeMs ?? null,
        saved.reason ? encode(saved.reason) : null,
        saved.message ?? null
      );
      this.audit(saved.actor, "payer_update.saved", "PayerUpdate", saved.id, null, saved, {
        workItemId: saved.workItemId
      });
      return snapshot(saved);
    });
  }

  getPayerUpdatesForWorkItem(workItemId: string): PayerUpdate[] {
    return (this.db.prepare(`
      SELECT * FROM payer_updates WHERE work_item_id = ? ORDER BY created_at, id
    `).all(workItemId) as Row[]).map((row) => this.payerUpdateFromRow(row));
  }

  getLatestPayerUpdateForWorkItem(workItemId: string): PayerUpdate | null {
    return this.getPayerUpdatesForWorkItem(workItemId).at(-1) ?? null;
  }

  saveMoreInfoRequest(request: Omit<MoreInfoRequest, "id" | "requestedAt"> & { requestedAt?: string }): MoreInfoRequest {
    return this.transaction(() => {
      const saved: MoreInfoRequest = {
        ...request,
        id: this.nextPrefixedId("more_info_requests", "id", "mir"),
        requestedAt: request.requestedAt ?? this.nowIso()
      };
      this.db.prepare(`
        INSERT INTO more_info_requests (
          id, work_item_id, message, requested_items_json, due_at, requested_at, resolved_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        saved.id,
        saved.workItemId,
        saved.message,
        encode(saved.requestedItems),
        saved.dueAt ?? null,
        saved.requestedAt,
        saved.resolvedAt ?? null
      );
      this.audit("mock-payer", "more_info_request.saved", "MoreInfoRequest", saved.id, null, saved, {
        workItemId: saved.workItemId
      });
      return snapshot(saved);
    });
  }

  resolveOpenMoreInfoRequest(workItemId: string, actor: OperationEvent["actor"] = "user"): MoreInfoRequest | null {
    return this.transaction(() => {
      const openRequest = this.getMoreInfoRequestsForWorkItem(workItemId).find((request) => !request.resolvedAt);
      if (!openRequest) {
        return null;
      }
      const resolved = {
        ...openRequest,
        resolvedAt: this.nowIso()
      };
      this.db.prepare("UPDATE more_info_requests SET resolved_at = ? WHERE id = ?").run(resolved.resolvedAt, resolved.id);
      this.audit(actor, "more_info_request.resolved", "MoreInfoRequest", resolved.id, openRequest, resolved, {
        workItemId
      });
      return snapshot(resolved);
    });
  }

  getMoreInfoRequestsForWorkItem(workItemId: string): MoreInfoRequest[] {
    return (this.db.prepare(`
      SELECT * FROM more_info_requests WHERE work_item_id = ? ORDER BY requested_at, id
    `).all(workItemId) as Row[]).map((row) => this.moreInfoRequestFromRow(row));
  }

  recordOperationEvent(
    workItemId: string,
    type: OperationEventType,
    actor: OperationEvent["actor"],
    details: unknown
  ): OperationEvent {
    return this.transaction(() => {
      const event: OperationEvent = {
        id: this.nextPrefixedId("operation_events", "id", "oe"),
        workItemId,
        type,
        actor,
        createdAt: this.nowIso(),
        details: snapshot(details)
      };
      this.db.prepare(`
        INSERT INTO operation_events (id, work_item_id, type, actor, created_at, details_json)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(event.id, event.workItemId, event.type, event.actor, event.createdAt, encode(event.details));
      this.audit(actor, `operation_event.${type}`, "OperationEvent", event.id, null, event, {
        workItemId
      });
      return snapshot(event);
    });
  }

  getOperationEventsForWorkItem(workItemId: string): OperationEvent[] {
    return (this.db.prepare(`
      SELECT * FROM operation_events WHERE work_item_id = ? ORDER BY created_at, id
    `).all(workItemId) as Row[]).map((row) => ({
      id: text(row.id),
      workItemId: text(row.work_item_id),
      type: text(row.type) as OperationEventType,
      actor: text(row.actor) as OperationEvent["actor"],
      createdAt: text(row.created_at),
      details: decode(row.details_json)
    }));
  }

  getStatusEvents(workItemId: string): StatusEvent[] {
    return (this.db.prepare(`
      SELECT * FROM status_events WHERE work_item_id = ? ORDER BY at, event_id
    `).all(workItemId) as Row[]).map((row) => ({
      eventId: text(row.event_id),
      workItemId: text(row.work_item_id),
      fromStatus: nullableText(row.from_status) as StatusEvent["fromStatus"],
      toStatus: text(row.to_status) as WorkItem["status"],
      actor: text(row.actor),
      at: text(row.at),
      causedBy: text(row.caused_by),
      packetId: nullableText(row.packet_id) ?? undefined,
      receiptId: nullableText(row.receipt_id) ?? undefined
    }));
  }

  getAuditEventsForWorkItem(workItemId: string): AuditEvent[] {
    return (this.db.prepare(`
      SELECT * FROM audit_events WHERE work_item_id = ? ORDER BY sequence
    `).all(workItemId) as Row[]).map(auditEventFromRow);
  }

  saveEvidenceAttachment(attachment: EvidenceAttachment, actor = "system", action = "evidence.saved"): EvidenceAttachment {
    return this.transaction(() => {
      const previous = this.getEvidenceAttachment(attachment.id);
      this.db.prepare(`
        INSERT INTO evidence_attachments (
          id, work_item_id, source, fixture_id, status, content_mode, title, filename,
          content_type, size_bytes, sha256, storage_key, inline_base64,
          document_reference_json, binary_json, created_at, updated_at, accepted_at,
          removed_at, included_in_packet_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          title = excluded.title,
          filename = excluded.filename,
          content_type = excluded.content_type,
          size_bytes = excluded.size_bytes,
          sha256 = excluded.sha256,
          storage_key = excluded.storage_key,
          inline_base64 = excluded.inline_base64,
          document_reference_json = excluded.document_reference_json,
          binary_json = excluded.binary_json,
          updated_at = excluded.updated_at,
          accepted_at = excluded.accepted_at,
          removed_at = excluded.removed_at,
          included_in_packet_id = excluded.included_in_packet_id
      `).run(
        attachment.id,
        attachment.workItemId,
        attachment.source,
        attachment.fixtureId ?? null,
        attachment.status,
        attachment.contentMode,
        attachment.title,
        attachment.filename,
        attachment.contentType,
        attachment.sizeBytes,
        attachment.sha256,
        attachment.storageKey ?? null,
        attachment.inlineBase64 ?? null,
        encode(attachment.documentReference),
        attachment.binary ? encode(attachment.binary) : null,
        attachment.createdAt,
        attachment.updatedAt,
        attachment.acceptedAt ?? null,
        attachment.removedAt ?? null,
        attachment.includedInPacketId ?? null
      );
      this.audit(actor, action, "EvidenceAttachment", attachment.id, previous, attachment, {
        workItemId: attachment.workItemId,
        packetId: attachment.includedInPacketId
      });
      return snapshot(attachment);
    });
  }

  getEvidenceAttachment(id: string): EvidenceAttachment | null {
    return this.evidenceAttachmentFromRow(
      this.db.prepare("SELECT * FROM evidence_attachments WHERE id = ?").get(id) as Row | undefined
    );
  }

  getEvidenceAttachmentsForWorkItem(workItemId: string): EvidenceAttachment[] {
    return (this.db.prepare(`
      SELECT * FROM evidence_attachments WHERE work_item_id = ? ORDER BY created_at, id
    `).all(workItemId) as Row[]).map((row) => this.evidenceAttachmentFromRow(row)).filter(isPresent);
  }

  markEvidenceIncludedInPacket(workItemId: string, evidenceId: string, packetId: string, actor = "system"): EvidenceAttachment {
    return this.transaction(() => {
      const attachment = this.getEvidenceAttachment(evidenceId);
      if (!attachment || attachment.workItemId !== workItemId) {
        throw new Error(`Unknown evidence attachment: ${evidenceId}`);
      }
      const updated: EvidenceAttachment = {
        ...attachment,
        status: "included-in-packet",
        includedInPacketId: packetId,
        updatedAt: this.nowIso()
      };
      return this.saveEvidenceAttachment(updated, actor, "evidence.included_in_packet");
    });
  }

  hasWorkItems(): boolean {
    const row = this.db.prepare("SELECT COUNT(*) AS count FROM work_items").get() as Row;
    return number(row.count) > 0;
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL CHECK (length(applied_at) > 0)
      ) STRICT;
    `);
    const current = this.db.prepare("SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations").get() as Row;
    let version = number(current.version);
    if (version >= SCHEMA_VERSION) {
      return;
    }
    if (version === 0) {
      this.transaction(() => {
        this.db.exec(SCHEMA_SQL);
        this.db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
          .run(1, this.nowIso());
      });
      version = 1;
    }
    if (version === 1) {
      this.db.exec("PRAGMA foreign_keys = OFF;");
      try {
        this.transaction(() => {
          this.db.exec(SCHEMA_V2_SQL);
          this.db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)")
            .run(2, this.nowIso());
        });
      } finally {
        this.db.exec("PRAGMA foreign_keys = ON;");
      }
    }
  }

  private getWorkItemByEvaluationId(evaluationId: string): WorkItem | null {
    return this.workItemFromRow(
      this.db.prepare("SELECT * FROM work_items WHERE evaluation_id = ?").get(evaluationId) as Row | undefined
    );
  }

  private insertWorkItem(workItem: WorkItem): void {
    this.db.prepare(`
      INSERT INTO work_items (
        id, evaluation_id, patient_id, coverage_id, request_resource_type, request_resource_id,
        service_line, payer_id, owner_user_id, status, created_at, requirement_result_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        owner_user_id = excluded.owner_user_id,
        status = excluded.status,
        requirement_result_json = excluded.requirement_result_json
    `).run(
      workItem.id,
      workItem.evaluationId,
      workItem.patientId,
      workItem.coverageId,
      workItem.requestResourceType,
      workItem.requestResourceId,
      workItem.serviceLine,
      workItem.payerId,
      workItem.ownerUserId,
      workItem.status,
      workItem.createdAt,
      encode(workItem.requirementResult)
    );
  }

  private workItemFromRow(row: Row | undefined): WorkItem | null {
    if (!row) {
      return null;
    }
    return {
      id: text(row.id),
      evaluationId: text(row.evaluation_id),
      patientId: text(row.patient_id),
      coverageId: text(row.coverage_id),
      requestResourceType: text(row.request_resource_type) as WorkItem["requestResourceType"],
      requestResourceId: text(row.request_resource_id),
      serviceLine: text(row.service_line),
      payerId: text(row.payer_id),
      ownerUserId: nullableText(row.owner_user_id),
      status: text(row.status) as WorkItem["status"],
      createdAt: text(row.created_at),
      requirementResult: decode(row.requirement_result_json)
    };
  }

  private questionnaireSessionFromRow(row: Row | undefined): QuestionnaireSession | null {
    if (!row) {
      return null;
    }
    return {
      id: text(row.id),
      workItemId: text(row.work_item_id),
      questionnaireCanonical: text(row.questionnaire_canonical),
      questionnaireVersion: text(row.questionnaire_version),
      questionnaireResponse: decode(row.questionnaire_response_json),
      validation: decode(row.validation_json),
      status: text(row.status) as QuestionnaireSession["status"],
      prefillOverrides: decode(row.prefill_overrides_json),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      revision: number(row.revision)
    };
  }

  private submissionPacketFromRow(row: Row | undefined): SubmissionPacket | null {
    if (!row) {
      return null;
    }
    return {
      id: text(row.id),
      workItemId: text(row.work_item_id),
      packetSchemaVersion: text(row.packet_schema_version) as SubmissionPacket["packetSchemaVersion"],
      builtAt: text(row.built_at),
      transport: text(row.transport) as SubmissionPacket["transport"],
      bundle: decode(row.bundle_json),
      attachmentManifest: decode(row.attachment_manifest_json),
      snapshot: decode(row.snapshot_json)
    };
  }

  private submissionReceiptFromRow(row: Row | undefined): SubmissionReceipt | null {
    if (!row) {
      return null;
    }
    return {
      packetId: text(row.packet_id),
      receiptId: text(row.receipt_id),
      trackingId: text(row.tracking_id),
      submittedAt: text(row.submitted_at),
      transport: text(row.transport) as SubmissionReceipt["transport"],
      idempotent: Boolean(row.idempotent),
      responseBundle: decode(row.response_bundle_json)
    };
  }

  private payerUpdateFromRow(row: Row): PayerUpdate {
    return {
      id: text(row.id),
      workItemId: text(row.work_item_id),
      status: text(row.status) as PayerUpdate["status"],
      actor: text(row.actor) as PayerUpdate["actor"],
      createdAt: text(row.created_at),
      submittedAt: text(row.submitted_at),
      decidedAt: nullableText(row.decided_at) ?? undefined,
      decisionTimeMs: nullableNumber(row.decision_time_ms),
      reason: row.reason_json === null ? undefined : decode(row.reason_json),
      message: nullableText(row.message) ?? undefined
    };
  }

  private moreInfoRequestFromRow(row: Row): MoreInfoRequest {
    return {
      id: text(row.id),
      workItemId: text(row.work_item_id),
      message: text(row.message),
      requestedItems: decode(row.requested_items_json),
      dueAt: nullableText(row.due_at) ?? undefined,
      requestedAt: text(row.requested_at),
      resolvedAt: nullableText(row.resolved_at) ?? undefined
    };
  }

  private evidenceAttachmentFromRow(row: Row | undefined): EvidenceAttachment | null {
    if (!row) {
      return null;
    }
    return {
      id: text(row.id),
      workItemId: text(row.work_item_id),
      source: text(row.source) as EvidenceAttachment["source"],
      fixtureId: nullableText(row.fixture_id) ?? undefined,
      status: text(row.status) as EvidenceAttachment["status"],
      contentMode: text(row.content_mode) as EvidenceAttachment["contentMode"],
      title: text(row.title),
      filename: text(row.filename),
      contentType: text(row.content_type),
      sizeBytes: number(row.size_bytes),
      sha256: text(row.sha256),
      storageKey: nullableText(row.storage_key) ?? undefined,
      inlineBase64: nullableText(row.inline_base64) ?? undefined,
      documentReference: decode(row.document_reference_json),
      binary: row.binary_json === null ? undefined : decode(row.binary_json),
      createdAt: text(row.created_at),
      updatedAt: text(row.updated_at),
      acceptedAt: nullableText(row.accepted_at) ?? undefined,
      removedAt: nullableText(row.removed_at) ?? undefined,
      includedInPacketId: nullableText(row.included_in_packet_id) ?? undefined
    };
  }

  private recordStatusEvent(input: Omit<StatusEvent, "eventId" | "at">): void {
    const eventId = this.nextPrefixedId("status_events", "event_id", "se");
    this.db.prepare(`
      INSERT INTO status_events (
        event_id, work_item_id, from_status, to_status, actor, at, caused_by, packet_id, receipt_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      input.workItemId,
      input.fromStatus,
      input.toStatus,
      input.actor,
      this.nowIso(),
      input.causedBy,
      input.packetId ?? null,
      input.receiptId ?? null
    );
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
    const sequence = this.nextAuditSequence();
    this.db.prepare(`
      INSERT INTO audit_events (
        sequence, event_id, actor, action, resource_type, resource_id, timestamp,
        before_json, after_json, work_item_id, packet_id, receipt_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      sequence,
      `ae-${String(sequence).padStart(6, "0")}`,
      actor,
      action,
      resourceType,
      resourceId,
      this.nowIso(),
      beforeJson === null ? null : encode(snapshot(beforeJson)),
      afterJson === null ? null : encode(snapshot(afterJson)),
      links.workItemId ?? null,
      links.packetId ?? null,
      links.receiptId ?? null
    );
  }

  private nextAuditSequence(): number {
    const row = this.db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM audit_events").get() as Row;
    return number(row.next);
  }

  private nextPrefixedId(table: string, column: string, prefix: string): string {
    const row = this.db.prepare(`
      SELECT COALESCE(MAX(CAST(substr(${column}, length(?) + 2) AS INTEGER)), 0) + 1 AS next
      FROM ${table}
      WHERE ${column} LIKE ? || '-%'
    `).get(prefix, prefix) as Row;
    return `${prefix}-${String(number(row.next)).padStart(6, "0")}`;
  }
}

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function decode<T = any>(value: unknown): T {
  return JSON.parse(text(value)) as T;
}

function text(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`Expected SQLite text value, received ${typeof value}`);
  }
  return value;
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function number(value: unknown): number {
  if (typeof value !== "number") {
    throw new Error(`Expected SQLite number value, received ${typeof value}`);
  }
  return value;
}

function nullableNumber(value: unknown): number | undefined {
  return value === null || value === undefined ? undefined : number(value);
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function auditEventFromRow(row: Row): AuditEvent {
  return {
    eventId: text(row.event_id),
    sequence: number(row.sequence),
    actor: text(row.actor),
    action: text(row.action),
    resourceType: text(row.resource_type),
    resourceId: text(row.resource_id),
    timestamp: text(row.timestamp),
    beforeJson: row.before_json === null ? null : decode(row.before_json),
    afterJson: row.after_json === null ? null : decode(row.after_json),
    workItemId: nullableText(row.work_item_id) ?? undefined,
    packetId: nullableText(row.packet_id) ?? undefined,
    receiptId: nullableText(row.receipt_id) ?? undefined
  };
}

const STATUS_CHECK = "'draft','requirements_found','not_required','needs_baseline_data','questionnaire_in_progress','review_ready','packet_ready','submitted','more_info_needed','approved','denied','cancelled','submission_failed'";
const PAYER_STATUS_CHECK = "'pended','approved','denied','cancelled'";
const ACTOR_CHECK = "'user','mock-payer','system'";
const SUBMISSION_PACKET_COLUMNS_SQL = `
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  packet_schema_version TEXT NOT NULL CHECK (packet_schema_version IN ('m3.local-pas-style.v1','m7.local-pas-evidence.v1')),
  built_at TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport = 'mock-pas'),
  bundle_json TEXT NOT NULL CHECK (json_valid(bundle_json)),
  attachment_manifest_json TEXT NOT NULL CHECK (json_valid(attachment_manifest_json)),
  snapshot_json TEXT NOT NULL CHECK (json_valid(snapshot_json)),
  snapshot_work_item_id TEXT NOT NULL,
  snapshot_questionnaire_response_id TEXT NOT NULL,
  snapshot_questionnaire_response_revision INTEGER NOT NULL CHECK (snapshot_questionnaire_response_revision >= 1),
  snapshot_payer_id TEXT NOT NULL,
  UNIQUE (
    snapshot_work_item_id,
    snapshot_questionnaire_response_id,
    snapshot_questionnaire_response_revision,
    snapshot_payer_id,
    packet_schema_version
  )
`;

const SCHEMA_SQL = `
CREATE TABLE requirement_runs (
  evaluation_id TEXT PRIMARY KEY NOT NULL,
  request_json TEXT NOT NULL CHECK (json_valid(request_json)),
  result_json TEXT NOT NULL CHECK (json_valid(result_json)),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0)
) STRICT;

CREATE TABLE work_items (
  id TEXT PRIMARY KEY NOT NULL,
  evaluation_id TEXT NOT NULL UNIQUE REFERENCES requirement_runs(evaluation_id) ON DELETE RESTRICT,
  patient_id TEXT NOT NULL,
  coverage_id TEXT NOT NULL,
  request_resource_type TEXT NOT NULL CHECK (request_resource_type IN ('ServiceRequest','MedicationRequest','DeviceRequest')),
  request_resource_id TEXT NOT NULL,
  service_line TEXT NOT NULL,
  payer_id TEXT NOT NULL,
  owner_user_id TEXT,
  status TEXT NOT NULL CHECK (status IN (${STATUS_CHECK})),
  created_at TEXT NOT NULL CHECK (length(created_at) > 0),
  requirement_result_json TEXT NOT NULL CHECK (json_valid(requirement_result_json))
) STRICT;

CREATE TABLE questionnaire_sessions (
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  questionnaire_canonical TEXT NOT NULL,
  questionnaire_version TEXT NOT NULL,
  questionnaire_response_json TEXT NOT NULL CHECK (json_valid(questionnaire_response_json)),
  validation_json TEXT NOT NULL CHECK (json_valid(validation_json)),
  status TEXT NOT NULL CHECK (status IN ('draft','review_ready')),
  prefill_overrides_json TEXT NOT NULL CHECK (json_valid(prefill_overrides_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision >= 1)
) STRICT;

CREATE TABLE submission_packets (
${SUBMISSION_PACKET_COLUMNS_SQL}
) STRICT;

CREATE TABLE submission_receipts (
  receipt_id TEXT PRIMARY KEY NOT NULL,
  packet_id TEXT NOT NULL UNIQUE REFERENCES submission_packets(id) ON DELETE CASCADE,
  tracking_id TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  transport TEXT NOT NULL CHECK (transport = 'mock-pas'),
  idempotent INTEGER NOT NULL CHECK (idempotent IN (0, 1)),
  response_bundle_json TEXT NOT NULL CHECK (json_valid(response_bundle_json))
) STRICT;

CREATE TABLE status_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  from_status TEXT CHECK (from_status IS NULL OR from_status IN (${STATUS_CHECK})),
  to_status TEXT NOT NULL CHECK (to_status IN (${STATUS_CHECK})),
  actor TEXT NOT NULL,
  at TEXT NOT NULL,
  caused_by TEXT NOT NULL,
  packet_id TEXT,
  receipt_id TEXT
) STRICT;

CREATE TABLE payer_updates (
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN (${PAYER_STATUS_CHECK})),
  actor TEXT NOT NULL CHECK (actor IN (${ACTOR_CHECK})),
  created_at TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  decided_at TEXT,
  decision_time_ms INTEGER CHECK (decision_time_ms IS NULL OR decision_time_ms >= 0),
  reason_json TEXT CHECK (reason_json IS NULL OR json_valid(reason_json)),
  message TEXT
) STRICT;

CREATE TABLE more_info_requests (
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  message TEXT NOT NULL CHECK (length(message) > 0),
  requested_items_json TEXT NOT NULL CHECK (json_valid(requested_items_json)),
  due_at TEXT,
  requested_at TEXT NOT NULL,
  resolved_at TEXT
) STRICT;

CREATE TABLE operation_events (
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payer_status_recorded','more_info_requested','more_info_resolved','case_assigned','case_cancelled','evidence_attached','evidence_uploaded','evidence_accepted','evidence_removed','evidence_included_in_packet')),
  actor TEXT NOT NULL CHECK (actor IN (${ACTOR_CHECK})),
  created_at TEXT NOT NULL,
  details_json TEXT NOT NULL CHECK (json_valid(details_json))
) STRICT;

CREATE TABLE audit_events (
  sequence INTEGER PRIMARY KEY NOT NULL CHECK (sequence > 0),
  event_id TEXT NOT NULL UNIQUE,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  before_json TEXT CHECK (before_json IS NULL OR json_valid(before_json)),
  after_json TEXT CHECK (after_json IS NULL OR json_valid(after_json)),
  work_item_id TEXT,
  packet_id TEXT,
  receipt_id TEXT
) STRICT;

CREATE INDEX idx_status_events_work_item ON status_events(work_item_id, at);
CREATE INDEX idx_audit_events_work_item ON audit_events(work_item_id, sequence);
CREATE INDEX idx_payer_updates_work_item ON payer_updates(work_item_id, created_at);
CREATE INDEX idx_more_info_requests_work_item ON more_info_requests(work_item_id, requested_at);
CREATE INDEX idx_operation_events_work_item ON operation_events(work_item_id, created_at);
CREATE INDEX idx_submission_packets_work_item ON submission_packets(work_item_id, built_at);
`;

const SCHEMA_V2_SQL = `
CREATE TABLE IF NOT EXISTS evidence_attachments (
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('fixture','upload')),
  fixture_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('available','attached','accepted','removed','included-in-packet')),
  content_mode TEXT NOT NULL CHECK (content_mode IN ('inline-base64','local-binary','local-reference','bundle-fixture')),
  title TEXT NOT NULL CHECK (length(title) > 0),
  filename TEXT NOT NULL CHECK (length(filename) > 0),
  content_type TEXT NOT NULL CHECK (length(content_type) > 0),
  size_bytes INTEGER NOT NULL CHECK (size_bytes >= 0),
  sha256 TEXT NOT NULL CHECK (length(sha256) > 0),
  storage_key TEXT,
  inline_base64 TEXT,
  document_reference_json TEXT NOT NULL CHECK (json_valid(document_reference_json)),
  binary_json TEXT CHECK (binary_json IS NULL OR json_valid(binary_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  accepted_at TEXT,
  removed_at TEXT,
  included_in_packet_id TEXT
) STRICT;

CREATE INDEX IF NOT EXISTS idx_evidence_attachments_work_item ON evidence_attachments(work_item_id, created_at);

CREATE TABLE IF NOT EXISTS submission_packets_v2 (
${SUBMISSION_PACKET_COLUMNS_SQL}
) STRICT;

INSERT OR IGNORE INTO submission_packets_v2 (
  id, work_item_id, packet_schema_version, built_at, transport, bundle_json,
  attachment_manifest_json, snapshot_json, snapshot_work_item_id,
  snapshot_questionnaire_response_id, snapshot_questionnaire_response_revision, snapshot_payer_id
)
SELECT
  id, work_item_id, packet_schema_version, built_at, transport, bundle_json,
  attachment_manifest_json, snapshot_json, snapshot_work_item_id,
  snapshot_questionnaire_response_id, snapshot_questionnaire_response_revision, snapshot_payer_id
FROM submission_packets;

DROP TABLE submission_packets;
ALTER TABLE submission_packets_v2 RENAME TO submission_packets;
CREATE INDEX IF NOT EXISTS idx_submission_packets_work_item ON submission_packets(work_item_id, built_at);

CREATE TABLE IF NOT EXISTS operation_events_v2 (
  id TEXT PRIMARY KEY NOT NULL,
  work_item_id TEXT NOT NULL REFERENCES work_items(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payer_status_recorded','more_info_requested','more_info_resolved','case_assigned','case_cancelled','evidence_attached','evidence_uploaded','evidence_accepted','evidence_removed','evidence_included_in_packet')),
  actor TEXT NOT NULL CHECK (actor IN (${ACTOR_CHECK})),
  created_at TEXT NOT NULL,
  details_json TEXT NOT NULL CHECK (json_valid(details_json))
) STRICT;

INSERT OR IGNORE INTO operation_events_v2 (id, work_item_id, type, actor, created_at, details_json)
SELECT id, work_item_id, type, actor, created_at, details_json FROM operation_events;

DROP TABLE operation_events;
ALTER TABLE operation_events_v2 RENAME TO operation_events;
CREATE INDEX IF NOT EXISTS idx_operation_events_work_item ON operation_events(work_item_id, created_at);
`;
