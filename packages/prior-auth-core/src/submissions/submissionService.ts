import type {
  EvidenceAttachment,
  FhirBundle,
  PacketBuildRequest,
  PacketSubmitRequest,
  QuestionnaireSession,
  SubmissionAttachmentManifestEntry,
  SubmissionPacket,
  SubmissionPacketSnapshot,
  SubmissionReceipt,
  WorkItem
} from "@open-prior-auth/shared-types";
import { OperationOutcomeError } from "../errors.js";
import { EvidenceRepository, evidenceDigest } from "../evidence/evidenceRepository.js";
import { evaluationHash } from "../evaluation/hash.js";
import { type ClinicalContextRepository, type FhirResource } from "../ports.js";
import { type PriorAuthStore } from "../storage/priorAuthStore.js";

const PACKET_SCHEMA_VERSION = "m7.local-pas-evidence.v1" as const;

export class SubmissionService {
  constructor(
    private readonly repository: ClinicalContextRepository,
    private readonly store: PriorAuthStore
  ) {
    this.evidenceRepository = new EvidenceRepository(store);
  }

  private readonly evidenceRepository: EvidenceRepository;

  buildPacket(input: PacketBuildRequest): SubmissionPacket {
    return this.store.transaction(() => {
      const actor = input.actorUserId ?? "system";
      const workItem = this.requireWorkItem(input.workItemId);

      if (workItem.status !== "review_ready" && workItem.status !== "packet_ready") {
        throw new OperationOutcomeError(
          409,
          "conflict",
          `Work item ${workItem.id} must be review_ready before building a PAS-style local packet. Current status: ${workItem.status}.`
        );
      }

      const session = this.requireReviewReadySession(workItem);
      const evidenceAttachments = this.evidenceRepository.acceptedEvidenceForPacket(workItem.id);
      const snapshot = buildSnapshot(workItem, session, evidenceAttachments);
      const existing = this.store.findSubmissionPacketBySnapshot(snapshot);
      if (existing) {
        if (workItem.status === "review_ready") {
          this.store.updateWorkItemStatus(workItem.id, "packet_ready", actor, "submission_packet.reused", existing.id);
        }
        return existing;
      }

      const packet = this.createPacket(workItem, session, snapshot, evidenceAttachments);
      this.store.saveSubmissionPacket(packet, actor);
      for (const evidence of evidenceAttachments) {
        if (evidence.includedInPacketId !== packet.id) {
          this.store.markEvidenceIncludedInPacket(workItem.id, evidence.id, packet.id, actor);
          this.store.recordOperationEvent(workItem.id, "evidence_included_in_packet", "system", {
            evidenceAttachmentId: evidence.id,
            packetId: packet.id
          });
        }
      }
      this.store.updateWorkItemStatus(workItem.id, "packet_ready", actor, "submission_packet.built", packet.id);
      return packet;
    });
  }

  submitPacket(input: PacketSubmitRequest): SubmissionReceipt {
    return this.store.transaction(() => {
      const actor = input.actorUserId ?? "system";
      const packet = this.store.getSubmissionPacket(input.packetId);
      if (!packet) {
        throw new OperationOutcomeError(404, "not-found", `Submission packet not found: ${input.packetId}`);
      }

      const workItem = this.requireWorkItem(packet.workItemId);
      const currentSession = this.requireReviewReadySession(workItem);
      if (currentSession.revision !== packet.snapshot.questionnaireResponseRevision) {
        throw new OperationOutcomeError(
          409,
          "conflict",
          `Submission packet ${packet.id} is stale because QuestionnaireResponse revision ${currentSession.revision} no longer matches packet revision ${packet.snapshot.questionnaireResponseRevision}. Rebuild before submitting.`
        );
      }

      const existingReceipt = this.store.getSubmissionReceiptByPacketId(packet.id);
      if (existingReceipt) {
        return {
          ...existingReceipt,
          idempotent: true
        };
      }

      if (workItem.status !== "packet_ready") {
        throw new OperationOutcomeError(
          409,
          "conflict",
          `Work item ${workItem.id} must be packet_ready before mock PAS submission. Current status: ${workItem.status}.`
        );
      }

      const receipt = this.createReceipt(packet);
      this.store.saveSubmissionReceipt(receipt, actor);
      this.store.updateWorkItemStatus(
        workItem.id,
        "submitted",
        actor,
        "submission_packet.submitted",
        packet.id,
        receipt.receiptId
      );
      return receipt;
    });
  }

  private createPacket(
    workItem: WorkItem,
    session: QuestionnaireSession,
    snapshot: SubmissionPacketSnapshot,
    evidenceAttachments: EvidenceAttachment[]
  ): SubmissionPacket {
    const packetId = `packet-${evaluationHash(snapshot)}`;
    const context = this.repository.getPatientContext(
      workItem.patientId,
      workItem.coverageId,
      workItem.requestResourceType,
      workItem.requestResourceId
    );
    const evidenceEntries = evidenceAttachments.flatMap((attachment) => evidenceResources(attachment));
    const manifestEntries = evidenceAttachments.map((attachment) => manifestEntry(attachment));
    const claim = buildClaim(packetId, workItem, session, this.store.nowIso(), manifestEntries, context);
    const resources = [
      context.patient,
      context.coverage,
      context.encounter,
      context.practitioner,
      context.organization,
      context.request,
      ...context.conditions,
      ...context.observations,
      session.questionnaireResponse,
      ...evidenceEntries,
      claim
    ].filter((resource): resource is FhirResource => Boolean(resource));

    return {
      id: packetId,
      workItemId: workItem.id,
      packetSchemaVersion: PACKET_SCHEMA_VERSION,
      builtAt: this.store.nowIso(),
      transport: "mock-pas",
      bundle: {
        resourceType: "Bundle",
        id: `bundle-${packetId}`,
        type: "collection",
        timestamp: this.store.nowIso(),
        entry: resources.map((resource) => ({
          fullUrl: `urn:uuid:${resource.resourceType}-${resource.id ?? evaluationHash(resource)}`,
          resource
        }))
      },
      attachmentManifest: {
        attachments: manifestEntries,
        evidenceDigest: snapshot.evidenceDigest,
        ...(manifestEntries.length === 0 ? { missingFixtureReason: "No accepted evidence attachments" as const } : {})
      },
      snapshot
    };
  }

  private createReceipt(packet: SubmissionPacket): SubmissionReceipt {
    const receiptId = `receipt-${evaluationHash({ packetId: packet.id, transport: "mock-pas" })}`;
    const trackingId = `mock-pas-${evaluationHash({ packetId: packet.id, receiptId })}`;
    const submittedAt = this.store.nowIso();
    const claim = packet.bundle.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource;
    const claimResponse = {
      resourceType: "ClaimResponse",
      id: `claimresponse-${evaluationHash({ packetId: packet.id })}`,
      status: "active",
      use: "preauthorization",
      outcome: "complete",
      disposition: "Accepted by mock PAS transport for local M3 demo.",
      request: claim?.id ? { reference: `Claim/${claim.id}` } : undefined,
      preAuthRef: trackingId,
      created: submittedAt
    };

    return {
      packetId: packet.id,
      receiptId,
      trackingId,
      submittedAt,
      transport: "mock-pas",
      idempotent: false,
      responseBundle: {
        resourceType: "Bundle",
        id: `bundle-${receiptId}`,
        type: "collection",
        timestamp: submittedAt,
        entry: [
          {
            fullUrl: `urn:uuid:${claimResponse.resourceType}-${claimResponse.id}`,
            resource: claimResponse
          }
        ]
      }
    };
  }

  private requireWorkItem(workItemId: string): WorkItem {
    const workItem = this.store.getWorkItem(workItemId);
    if (!workItem) {
      throw new OperationOutcomeError(404, "not-found", `Work item not found: ${workItemId}`);
    }
    return workItem;
  }

  private requireReviewReadySession(workItem: WorkItem): QuestionnaireSession {
    const sessions = this.store.getQuestionnaireSessionsForWorkItem(workItem.id);
    const session = sessions.find((candidate) => candidate.status === "review_ready");
    if (!session || session.questionnaireResponse.status !== "completed") {
      throw new OperationOutcomeError(
        409,
        "conflict",
        `Work item ${workItem.id} needs a completed review-ready QuestionnaireResponse before packet build or submit.`
      );
    }
    return session;
  }
}

function buildSnapshot(
  workItem: WorkItem,
  session: QuestionnaireSession,
  evidenceAttachments: EvidenceAttachment[]
): SubmissionPacketSnapshot {
  return {
    workItemId: workItem.id,
    questionnaireResponseId: session.questionnaireResponse.id,
    questionnaireResponseRevision: session.revision,
    payerId: workItem.payerId,
    packetSchemaVersion: PACKET_SCHEMA_VERSION,
    evidenceAttachmentIds: evidenceAttachments.map((attachment) => attachment.id),
    evidenceDigest: evidenceDigest(evidenceAttachments)
  };
}

function buildClaim(
  packetId: string,
  workItem: WorkItem,
  session: QuestionnaireSession,
  createdAt: string,
  attachments: SubmissionAttachmentManifestEntry[],
  context: ReturnType<ClinicalContextRepository["getPatientContext"]>
): FhirResource {
  return {
    resourceType: "Claim",
    id: `claim-${packetId.replace(/^packet-/, "")}`,
    status: "active",
    type: {
      text: "Professional prior authorization"
    },
    use: "preauthorization",
    patient: {
      reference: `Patient/${workItem.patientId}`
    },
    insurer: {
      identifier: {
        system: "http://openpriorauth.local/payer-id",
        value: workItem.payerId
      }
    },
    provider: {
      display: typeof context.organization?.name === "string" ? context.organization.name : "Synthetic Provider Organization"
    },
    created: createdAt,
    priority: {
      text: "normal"
    },
    supportingInfo: [
      {
        sequence: 1,
        category: {
          text: "QuestionnaireResponse"
        },
        valueReference: {
          reference: `QuestionnaireResponse/${session.questionnaireResponse.id}`
        }
      },
      ...attachments.map((attachment, index) => ({
        sequence: index + 2,
        category: {
          text: "Evidence attachment"
        },
        valueReference: {
          reference: `DocumentReference/${attachment.documentReferenceId}`
        }
      }))
    ],
    item: [
      {
        sequence: 1,
        productOrService: {
          text: workItem.requirementResult.requestSummary.serviceDescription
        },
        servicedReference: {
          reference: `${workItem.requestResourceType}/${workItem.requestResourceId}`
        }
      }
    ],
    extension: [
      {
        url: "http://openpriorauth.local/fhir/StructureDefinition/work-item-id",
        valueString: workItem.id
      },
      {
        url: "http://openpriorauth.local/fhir/StructureDefinition/packet-schema-version",
        valueString: PACKET_SCHEMA_VERSION
      }
    ]
  };
}

function evidenceResources(attachment: EvidenceAttachment): FhirResource[] {
  const resources = [attachment.documentReference as FhirResource];
  if (attachment.binary) {
    resources.push(attachment.binary as FhirResource);
  }
  return resources;
}

function manifestEntry(attachment: EvidenceAttachment): SubmissionAttachmentManifestEntry {
  return {
    evidenceAttachmentId: attachment.id,
    documentReferenceId: String(attachment.documentReference.id ?? `docref-${attachment.id}`),
    binaryId: attachment.binary?.id ? String(attachment.binary.id) : undefined,
    title: attachment.title,
    filename: attachment.filename,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    sha256: attachment.sha256,
    contentMode: attachment.contentMode,
    source: attachment.source
  };
}
