import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import type {
  AttachEvidenceRequest,
  EvidenceAttachment,
  EvidenceFixtureSummary,
  EvidenceListResponse,
  FhirBundle,
  UploadEvidenceRequest,
  WorkItem
} from "@open-prior-auth/shared-types";
import { defaultEvidenceUploadDirectory, resolveFromRepoRoot } from "../config/paths.js";
import { evaluationHash } from "../evaluation/hash.js";
import { OperationOutcomeError } from "../errors.js";
import { type PriorAuthStore } from "../storage/priorAuthStore.js";

const FIXTURE_PATH = "data/evidence/mri-lumbar-spine.evidence-fixtures.json";
const MAX_UPLOAD_BYTES = 512 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "application/json",
  "application/fhir+json",
  "image/png",
  "image/jpeg"
]);

interface EvidenceFixtureFile {
  fixtures: EvidenceFixture[];
}

interface EvidenceFixture {
  fixtureId: string;
  title: string;
  filename: string;
  contentType: string;
  contentMode: EvidenceAttachment["contentMode"];
  sizeBytes: number;
  sha256: string;
  base64Data?: string;
  bundle?: FhirBundle;
}

export class EvidenceRepository {
  constructor(
    private readonly store: PriorAuthStore,
    private readonly uploadDirectory = defaultEvidenceUploadDirectory()
  ) {}

  listEvidenceForWorkItem(workItemId: string): EvidenceListResponse {
    this.requireWorkItem(workItemId);
    return {
      conformance: false,
      mode: "local-non-conformant",
      workItemId,
      availableFixtures: loadFixtures().map(toFixtureSummary),
      attachments: this.store.getEvidenceAttachmentsForWorkItem(workItemId)
    };
  }

  attachFixture(workItemId: string, input: AttachEvidenceRequest): EvidenceAttachment {
    return this.store.transaction(() => {
      const workItem = this.requireMutableWorkItem(workItemId);
      const fixture = loadFixtures().find((candidate) => candidate.fixtureId === input.fixtureId);
      if (!fixture) {
        throw new OperationOutcomeError(404, "not-found", `Evidence fixture not found: ${input.fixtureId}`);
      }

      const now = this.store.nowIso();
      const id = `ev-${evaluationHash(`${workItem.id}|${fixture.fixtureId}`)}`;
      const attachment: EvidenceAttachment = {
        id,
        workItemId: workItem.id,
        source: "fixture",
        fixtureId: fixture.fixtureId,
        status: "attached",
        contentMode: fixture.contentMode,
        title: fixture.title,
        filename: fixture.filename,
        contentType: fixture.contentType,
        sizeBytes: fixture.sizeBytes,
        sha256: fixture.sha256,
        inlineBase64: fixture.contentMode === "inline-base64" ? fixture.base64Data : undefined,
        documentReference: buildDocumentReference(workItem, id, fixture),
        binary: fixture.contentMode === "local-binary" ? buildBinary(id, fixture) : undefined,
        createdAt: now,
        updatedAt: now
      };

      const saved = this.store.saveEvidenceAttachment(attachment, input.actorUserId ?? "system", "evidence.attached");
      this.store.recordOperationEvent(workItem.id, "evidence_attached", "user", {
        evidenceAttachmentId: saved.id,
        fixtureId: fixture.fixtureId
      });
      return saved;
    });
  }

  uploadEvidence(workItemId: string, input: UploadEvidenceRequest): EvidenceAttachment {
    return this.store.transaction(() => {
      const workItem = this.requireMutableWorkItem(workItemId);
      const filename = sanitizeFilename(input.filename);
      if (!filename) {
        throw new OperationOutcomeError(400, "required", "filename is required for evidence upload.");
      }
      if (!ALLOWED_MIME_TYPES.has(input.contentType)) {
        throw new OperationOutcomeError(400, "invalid", `Unsupported evidence contentType: ${input.contentType}`);
      }
      const bytes = decodeBase64(input.base64Data);
      if (bytes.byteLength > MAX_UPLOAD_BYTES) {
        throw new OperationOutcomeError(413, "too-costly", `Evidence upload exceeds ${MAX_UPLOAD_BYTES} bytes.`);
      }
      const sha256 = sha256Hex(bytes);
      if (input.sha256 && input.sha256 !== sha256) {
        throw new OperationOutcomeError(400, "invalid", "Evidence upload checksum mismatch.");
      }

      mkdirSync(this.uploadDirectory, { recursive: true });
      const now = this.store.nowIso();
      const id = `ev-${evaluationHash(`${workItem.id}|${filename}|${sha256}`)}`;
      const storageKey = `${id}-${filename}`;
      writeFileSync(join(this.uploadDirectory, storageKey), bytes);
      const attachment: EvidenceAttachment = {
        id,
        workItemId: workItem.id,
        source: "upload",
        status: "attached",
        contentMode: "local-reference",
        title: input.title ?? filename,
        filename,
        contentType: input.contentType,
        sizeBytes: bytes.byteLength,
        sha256,
        storageKey,
        documentReference: buildUploadedDocumentReference(workItem, id, input.title ?? filename, filename, input.contentType, bytes.byteLength, sha256, storageKey),
        createdAt: now,
        updatedAt: now
      };

      const saved = this.store.saveEvidenceAttachment(attachment, input.actorUserId ?? "system", "evidence.uploaded");
      this.store.recordOperationEvent(workItem.id, "evidence_uploaded", "user", {
        evidenceAttachmentId: saved.id,
        filename,
        contentType: input.contentType
      });
      return saved;
    });
  }

  acceptEvidence(workItemId: string, evidenceId: string, actorUserId = "system"): EvidenceAttachment {
    return this.updateStatus(workItemId, evidenceId, "accepted", actorUserId, "evidence.accepted", "evidence_accepted");
  }

  removeEvidence(workItemId: string, evidenceId: string, actorUserId = "system"): EvidenceAttachment {
    return this.updateStatus(workItemId, evidenceId, "removed", actorUserId, "evidence.removed", "evidence_removed");
  }

  acceptedEvidenceForPacket(workItemId: string): EvidenceAttachment[] {
    return this.store.getEvidenceAttachmentsForWorkItem(workItemId)
      .filter((attachment) => attachment.status === "accepted" || attachment.status === "included-in-packet")
      .sort((first, second) => first.id.localeCompare(second.id));
  }

  private updateStatus(
    workItemId: string,
    evidenceId: string,
    status: "accepted" | "removed",
    actorUserId: string,
    action: string,
    operationType: "evidence_accepted" | "evidence_removed"
  ): EvidenceAttachment {
    return this.store.transaction(() => {
      this.requireMutableWorkItem(workItemId);
      const attachment = this.store.getEvidenceAttachment(evidenceId);
      if (!attachment || attachment.workItemId !== workItemId) {
        throw new OperationOutcomeError(404, "not-found", `Evidence attachment not found: ${evidenceId}`);
      }
      if (attachment.status === "included-in-packet") {
        throw new OperationOutcomeError(409, "conflict", `Evidence ${evidenceId} is already included in a packet.`);
      }
      const now = this.store.nowIso();
      const updated: EvidenceAttachment = {
        ...attachment,
        status,
        updatedAt: now,
        acceptedAt: status === "accepted" ? now : attachment.acceptedAt,
        removedAt: status === "removed" ? now : attachment.removedAt
      };
      const saved = this.store.saveEvidenceAttachment(updated, actorUserId, action);
      this.store.recordOperationEvent(workItemId, operationType, "user", {
        evidenceAttachmentId: saved.id
      });
      return saved;
    });
  }

  private requireMutableWorkItem(workItemId: string): WorkItem {
    const workItem = this.requireWorkItem(workItemId);
    if (["packet_ready", "submitted", "more_info_needed", "approved", "denied", "cancelled"].includes(workItem.status)) {
      throw new OperationOutcomeError(409, "conflict", `Evidence cannot be changed once work item ${workItem.id} is ${workItem.status}.`);
    }
    return workItem;
  }

  private requireWorkItem(workItemId: string): WorkItem {
    const workItem = this.store.getWorkItem(workItemId);
    if (!workItem) {
      throw new OperationOutcomeError(404, "not-found", `Work item not found: ${workItemId}`);
    }
    return workItem;
  }
}

export function loadEvidenceBytes(attachment: EvidenceAttachment, uploadDirectory = defaultEvidenceUploadDirectory()): Buffer | null {
  if (attachment.inlineBase64) {
    return Buffer.from(attachment.inlineBase64, "base64");
  }
  if (attachment.storageKey) {
    return readFileSync(join(uploadDirectory, attachment.storageKey));
  }
  if (attachment.binary?.data && typeof attachment.binary.data === "string") {
    return Buffer.from(attachment.binary.data, "base64");
  }
  return null;
}

export function evidenceDigest(attachments: EvidenceAttachment[]): string {
  return sha256Hex(Buffer.from(JSON.stringify(attachments.map((attachment) => ({
    id: attachment.id,
    contentMode: attachment.contentMode,
    contentType: attachment.contentType,
    filename: attachment.filename,
    sha256: attachment.sha256,
    sizeBytes: attachment.sizeBytes,
    title: attachment.title
  })).sort((first, second) => first.id.localeCompare(second.id))), "utf8"));
}

function loadFixtures(): EvidenceFixture[] {
  return (JSON.parse(readFileSync(resolveFromRepoRoot(FIXTURE_PATH), "utf8")) as EvidenceFixtureFile).fixtures;
}

function toFixtureSummary(fixture: EvidenceFixture): EvidenceFixtureSummary {
  return {
    fixtureId: fixture.fixtureId,
    title: fixture.title,
    filename: fixture.filename,
    contentType: fixture.contentType,
    sizeBytes: fixture.sizeBytes,
    sha256: fixture.sha256,
    contentMode: fixture.contentMode
  };
}

function sanitizeFilename(filename: string | undefined): string {
  return basename(filename ?? "").replace(/[^A-Za-z0-9._-]/g, "_");
}

function decodeBase64(value: string): Buffer {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value) || value.length % 4 !== 0) {
    throw new OperationOutcomeError(400, "invalid", "Evidence upload base64Data is malformed.");
  }
  const bytes = Buffer.from(value, "base64");
  if (bytes.toString("base64") !== value) {
    throw new OperationOutcomeError(400, "invalid", "Evidence upload base64Data is malformed.");
  }
  return bytes;
}

function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function buildDocumentReference(workItem: WorkItem, id: string, fixture: EvidenceFixture): Record<string, unknown> {
  return {
    resourceType: "DocumentReference",
    id: `docref-${id}`,
    status: "current",
    subject: { reference: `Patient/${workItem.patientId}` },
    description: fixture.title,
    content: [
      {
        attachment: {
          contentType: fixture.contentType,
          title: fixture.filename,
          size: fixture.sizeBytes,
          hash: fixture.sha256,
          ...(fixture.contentMode === "inline-base64" ? { data: fixture.base64Data } : {}),
          ...(fixture.contentMode === "local-binary" ? { url: `Binary/binary-${id}` } : {}),
          ...(fixture.contentMode === "bundle-fixture" ? { url: `Bundle/${fixture.bundle?.id ?? "bundle-like-evidence-smoke"}` } : {})
        }
      }
    ]
  };
}

function buildUploadedDocumentReference(
  workItem: WorkItem,
  id: string,
  title: string,
  filename: string,
  contentType: string,
  sizeBytes: number,
  sha256: string,
  storageKey: string
): Record<string, unknown> {
  return {
    resourceType: "DocumentReference",
    id: `docref-${id}`,
    status: "current",
    subject: { reference: `Patient/${workItem.patientId}` },
    description: title,
    content: [
      {
        attachment: {
          contentType,
          title: filename,
          size: sizeBytes,
          hash: sha256,
          url: `local-upload://${storageKey}`
        }
      }
    ]
  };
}

function buildBinary(id: string, fixture: EvidenceFixture): Record<string, unknown> {
  return {
    resourceType: "Binary",
    id: `binary-${id}`,
    contentType: fixture.contentType,
    data: fixture.base64Data
  };
}
