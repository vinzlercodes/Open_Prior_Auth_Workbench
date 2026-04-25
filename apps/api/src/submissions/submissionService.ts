import type {
  FhirBundle,
  PacketBuildRequest,
  PacketSubmitRequest,
  QuestionnaireSession,
  SubmissionPacket,
  SubmissionPacketSnapshot,
  SubmissionReceipt,
  WorkItem
} from "@open-prior-auth/shared-types";
import { OperationOutcomeError } from "../errors.js";
import { evaluationHash } from "../evaluation/hash.js";
import { type FhirResource, type FixtureFhirRepository } from "../fhir/fixtureRepository.js";
import { type MemoryStore } from "../storage/memoryStore.js";

const PACKET_SCHEMA_VERSION = "m3.local-pas-style.v1" as const;

export class SubmissionService {
  constructor(
    private readonly repository: FixtureFhirRepository,
    private readonly store: MemoryStore
  ) {}

  buildPacket(input: PacketBuildRequest): SubmissionPacket {
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
    const snapshot = buildSnapshot(workItem, session);
    const existing = this.store.findSubmissionPacketBySnapshot(snapshot);
    if (existing) {
      if (workItem.status === "review_ready") {
        this.store.updateWorkItemStatus(workItem.id, "packet_ready", actor, "submission_packet.reused", existing.id);
      }
      return existing;
    }

    const packet = this.createPacket(workItem, session, snapshot);
    this.store.saveSubmissionPacket(packet, actor);
    this.store.updateWorkItemStatus(workItem.id, "packet_ready", actor, "submission_packet.built", packet.id);
    return packet;
  }

  submitPacket(input: PacketSubmitRequest): SubmissionReceipt {
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
  }

  private createPacket(
    workItem: WorkItem,
    session: QuestionnaireSession,
    snapshot: SubmissionPacketSnapshot
  ): SubmissionPacket {
    const packetId = `packet-${evaluationHash(snapshot)}`;
    const context = this.repository.getPatientContext(
      workItem.patientId,
      workItem.coverageId,
      workItem.requestResourceType,
      workItem.requestResourceId
    );
    const claim = buildClaim(packetId, workItem, session);
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
      claim
    ].filter((resource): resource is FhirResource => Boolean(resource));

    return {
      id: packetId,
      workItemId: workItem.id,
      packetSchemaVersion: PACKET_SCHEMA_VERSION,
      builtAt: new Date().toISOString(),
      transport: "mock-pas",
      bundle: {
        resourceType: "Bundle",
        id: `bundle-${packetId}`,
        type: "collection",
        timestamp: new Date().toISOString(),
        entry: resources.map((resource) => ({
          fullUrl: `urn:uuid:${resource.resourceType}-${resource.id ?? evaluationHash(resource)}`,
          resource
        }))
      },
      attachmentManifest: {
        attachments: [],
        missingFixtureReason: "No document fixtures in M3"
      },
      snapshot
    };
  }

  private createReceipt(packet: SubmissionPacket): SubmissionReceipt {
    const receiptId = `receipt-${evaluationHash({ packetId: packet.id, transport: "mock-pas" })}`;
    const trackingId = `mock-pas-${evaluationHash({ packetId: packet.id, receiptId })}`;
    const submittedAt = new Date().toISOString();
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

function buildSnapshot(workItem: WorkItem, session: QuestionnaireSession): SubmissionPacketSnapshot {
  return {
    workItemId: workItem.id,
    questionnaireResponseId: session.questionnaireResponse.id,
    questionnaireResponseRevision: session.revision,
    payerId: workItem.payerId,
    packetSchemaVersion: PACKET_SCHEMA_VERSION
  };
}

function buildClaim(
  packetId: string,
  workItem: WorkItem,
  session: QuestionnaireSession
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
      display: "Northstar Spine Clinic"
    },
    created: new Date().toISOString(),
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
      }
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
