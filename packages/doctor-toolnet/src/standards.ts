import type {
  CdsHooksPrimaryHook,
  CdsHooksRequest,
  CdsHooksResponse,
  CdsServiceDescriptor,
  CdsServicesResponse,
  FhirBundle,
  PacketBuildRequest,
  PacketSubmitRequest,
  RequestResourceType,
  RequirementEvaluationRequest,
  SubmissionReceipt
} from "@open-prior-auth/shared-types";
import {
  buildSubmissionPacket,
  evaluateRequirements,
  QuestionnaireService,
  submitMockPacket
} from "@open-prior-auth/prior-auth-core";
import type {
  DoctorToolDependencies,
  StandardsDtrQuestionnairePackageOutput,
  StandardsPasClaimSubmitBundleOutput,
  StandardsPasRuntimeReceiptMapping,
  StandardsPasSubmitMockOutput
} from "./types.js";

const serviceDescriptors: readonly CdsServiceDescriptor[] = [
  {
    hook: "order-sign",
    id: "open-prior-auth-order-sign",
    title: "Open Prior Auth Order Sign",
    description: "Local non-conformant CRD-shaped requirement evaluation for signed orders.",
    prefetch: {
      draftOrders: "ServiceRequest fixture Bundle supplied by local test data."
    }
  },
  {
    hook: "appointment-book",
    id: "open-prior-auth-appointment-book",
    title: "Open Prior Auth Appointment Book",
    description: "Local non-conformant CRD-shaped requirement evaluation for appointment booking."
  },
  {
    hook: "order-dispatch",
    id: "open-prior-auth-order-dispatch",
    title: "Open Prior Auth Order Dispatch",
    description: "Local non-conformant CRD-shaped requirement evaluation for order dispatch."
  }
] as const;

export function discoverCrdServices(): CdsServicesResponse {
  return {
    services: [...serviceDescriptors],
    conformance: false,
    productionConformance: false,
    mode: "local-non-conformant"
  };
}

export function invokeCrdService(
  input: { serviceId: string; request: CdsHooksRequest },
  dependencies: DoctorToolDependencies
): CdsHooksResponse {
  const descriptor = requireService(input.serviceId);
  if (descriptor.hook !== input.request.hook) {
    throw new Error(`CDS service ${input.serviceId} expects hook ${descriptor.hook}, received ${input.request.hook}.`);
  }

  const request = toRequirementEvaluationRequest(input.request);
  const result = evaluateRequirements(request, dependencies.repository, dependencies.store);
  return {
    cards: [
      {
        summary: result.requiresPriorAuth
          ? "Prior authorization requirements found."
          : "No prior authorization requirement found.",
        indicator: result.requiresPriorAuth ? "info" : "success",
        detail: result.explanatoryNotes.join(" "),
        source: {
          label: "Open Prior Auth Workbench"
        },
        extension: {
          conformance: false,
          productionConformance: false,
          mode: "local-non-conformant",
          boundary: "crd",
          requirementEvaluation: result
        }
      }
    ],
    systemActions: [],
    conformance: false,
    productionConformance: false,
    mode: "local-non-conformant"
  };
}

export function getDtrQuestionnairePackageFhir(
  input: { workItemId: string },
  dependencies: DoctorToolDependencies
): StandardsDtrQuestionnairePackageOutput {
  const pkg = new QuestionnaireService(dependencies.repository, dependencies.store)
    .getStandardsPackage(input.workItemId);
  return {
    conformance: false,
    productionConformance: false,
    mode: "local-non-conformant",
    boundary: "dtr",
    operation: "Questionnaire/$questionnaire-package",
    response: pkg.response,
    expressionEvaluations: pkg.expressionEvaluations
  };
}

export function buildPasClaimSubmitBundle(
  input: PacketBuildRequest,
  dependencies: DoctorToolDependencies
): StandardsPasClaimSubmitBundleOutput {
  const packet = buildSubmissionPacket(input, dependencies.repository, dependencies.store);
  return {
    conformance: false,
    productionConformance: false,
    mode: "local-non-conformant",
    boundary: "pas",
    operation: "Claim/$submit",
    packet,
    claimSubmitBundle: packet.bundle
  };
}

export function submitPasClaimFhirMock(
  input: PacketSubmitRequest & { claimSubmitBundle?: FhirBundle },
  dependencies: DoctorToolDependencies
): StandardsPasSubmitMockOutput {
  const receipt = submitMockPacket(input, dependencies.repository, dependencies.store);
  return {
    conformance: false,
    productionConformance: false,
    mode: "local-non-conformant",
    boundary: "pas",
    operation: "Claim/$submit",
    receipt,
    claimResponseBundle: receipt.responseBundle
  };
}

export function mapPasClaimResponseToRuntimeReceipt(
  input: { packetId: string; claimResponseBundle: FhirBundle },
  dependencies: DoctorToolDependencies
): StandardsPasRuntimeReceiptMapping {
  const claimResponse = input.claimResponseBundle.entry
    .map((entry) => entry.resource)
    .find((resource) => resource.resourceType === "ClaimResponse");
  const receipt: SubmissionReceipt = {
    packetId: input.packetId,
    receiptId: typeof claimResponse?.id === "string" ? claimResponse.id : `receipt-${input.packetId}`,
    trackingId: typeof claimResponse?.preAuthRef === "string" ? claimResponse.preAuthRef : `mock-pas-${input.packetId}`,
    submittedAt: typeof claimResponse?.created === "string" ? claimResponse.created : nowIso(dependencies),
    transport: "mock-pas",
    idempotent: false,
    responseBundle: input.claimResponseBundle
  };
  return {
    conformance: false,
    productionConformance: false,
    mode: "local-non-conformant",
    boundary: "pas",
    packetId: input.packetId,
    receipt
  };
}

function requireService(serviceId: string): CdsServiceDescriptor {
  const service = serviceDescriptors.find((candidate) => candidate.id === serviceId);
  if (!service) {
    throw new Error(`Unknown local CRD service id: ${serviceId}`);
  }
  return service;
}

function toRequirementEvaluationRequest(request: CdsHooksRequest): RequirementEvaluationRequest {
  const context = request.context;
  const patientId = requireString(context.patientId, "context.patientId");
  const coverageId = requireString(context.coverageId, "context.coverageId");
  const payerId = requireString(context.payerId, "context.payerId");
  const serviceLine = requireString(context.serviceLine, "context.serviceLine");
  const requestResourceId = stringValue(context.requestResourceId)
    ?? stringValue(context.orderId)
    ?? findRequestResource(request)?.id;

  if (!requestResourceId) {
    throw new Error("CDS Hooks request must include context.requestResourceId, context.orderId, or a prefetched request resource.");
  }

  return {
    patientId,
    coverageId,
    requestResourceType: requestResourceType(findRequestResource(request)?.resourceType),
    requestResourceId,
    serviceLine,
    payerId
  };
}

function findRequestResource(request: CdsHooksRequest): { resourceType?: string; id?: string } | undefined {
  const values = Object.values(request.prefetch ?? {});
  for (const value of values) {
    const direct = asRequestResource(value);
    if (direct) {
      return direct;
    }
    if (isRecord(value) && Array.isArray(value.entry)) {
      for (const entry of value.entry) {
        if (isRecord(entry) && asRequestResource(entry.resource)) {
          return asRequestResource(entry.resource);
        }
      }
    }
  }
  return undefined;
}

function asRequestResource(value: unknown): { resourceType?: string; id?: string } | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  if (
    value.resourceType === "ServiceRequest"
    || value.resourceType === "MedicationRequest"
    || value.resourceType === "DeviceRequest"
  ) {
    return {
      resourceType: stringValue(value.resourceType),
      id: stringValue(value.id)
    };
  }
  return undefined;
}

function requestResourceType(value: unknown): RequestResourceType {
  if (value === "MedicationRequest" || value === "DeviceRequest") {
    return value;
  }
  return "ServiceRequest";
}

function requireString(value: unknown, label: string): string {
  const result = stringValue(value);
  if (!result) {
    throw new Error(`CDS Hooks request is missing ${label}.`);
  }
  return result;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function nowIso(dependencies: DoctorToolDependencies): string {
  return dependencies.clock?.nowIso() ?? new Date().toISOString();
}
