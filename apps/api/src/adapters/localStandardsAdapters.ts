import type {
  CdsHooksPrimaryHook,
  CdsHooksRequest,
  CdsHooksResponse,
  CdsServicesResponse,
  FhirBundle,
  FhirParameters,
  LocalStandardsBoundaryResponse,
  PacketBuildRequest,
  PacketSubmitRequest,
  QuestionnairePackageRequest,
  QuestionnaireResponseSaveRequest,
  RequirementEvaluationRequest,
  RequirementEvaluationResult,
  SmartDiscoveryMetadata,
  WorkItem
} from "@open-prior-auth/shared-types";
import { OperationOutcomeError } from "../errors.js";
import { evaluateRequirement } from "../evaluation/evaluate.js";
import { FixtureFhirRepository } from "../fhir/fixtureRepository.js";
import { QuestionnaireService } from "../questionnaires/questionnaireService.js";
import { type PriorAuthStore } from "../storage/priorAuthStore.js";
import { SubmissionService } from "../submissions/submissionService.js";

const DEFAULT_STANDARDS_REQUEST: RequirementEvaluationRequest = {
  patientId: "patient-mri-001",
  coverageId: "coverage-acme-001",
  requestResourceType: "ServiceRequest",
  requestResourceId: "servicerequest-mri-lumbar-001",
  serviceLine: "mri_lumbar_spine",
  payerId: "acme-health"
};

const CRD_SERVICE_IDS: Record<CdsHooksPrimaryHook, string> = {
  "appointment-book": "open-prior-auth-appointment-book",
  "order-dispatch": "open-prior-auth-order-dispatch",
  "order-sign": "open-prior-auth-order-sign"
};

export class LocalLaunchAdapter {
  readonly conformance = "local-launch-shim-not-smart" as const;
  readonly boundary = {
    boundary: "smart" as const,
    conformance: false as const,
    productionConformance: false as const,
    mode: "local-non-conformant" as const,
    contractVersion: "m8.smart-discovery-fixture.v1",
    notes: ["Fixture SMART discovery metadata only. No production OAuth, scopes, token validation, or EHR launch."]
  };

  constructor(private readonly repository: FixtureFhirRepository) {}

  getPatientContext(patientId: string) {
    return this.repository.getPatientContext(patientId);
  }

  smartConfiguration(): SmartDiscoveryMetadata {
    return {
      conformance: false,
      productionConformance: false,
      mode: "local-non-conformant",
      authorization_endpoint: "http://localhost:4000/smart/authorize",
      token_endpoint: "http://localhost:4000/smart/token",
      capabilities: ["launch-ehr", "client-public"],
      scopes_supported: ["launch", "patient/*.read", "openid", "fhirUser"]
    };
  }

  resolveLaunchContext(input: { patientId?: string }) {
    const patientId = input.patientId ?? "patient-mri-001";
    return {
      conformance: false,
      mode: "local-non-conformant",
      accessToken: `mock-token-${patientId}`,
      tokenType: "Bearer",
      patient: patientId,
      context: this.getPatientContext(patientId)
    };
  }
}

export class LocalCrdAdapter {
  readonly conformance = "local-crd-inspired-not-cds-hooks" as const;
  readonly boundary = {
    boundary: "crd" as const,
    conformance: false as const,
    productionConformance: false as const,
    mode: "local-non-conformant" as const,
    contractVersion: "m8.crd-fixture-harness.v1",
    notes: ["CDS Hooks primary-hook fixture harness around the local deterministic evaluator. Not production CRD conformance."]
  };

  constructor(
    private readonly repository: FixtureFhirRepository,
    private readonly store: PriorAuthStore
  ) {}

  evaluate(input: RequirementEvaluationRequest) {
    const result = evaluateRequirement(input, this.repository);
    return this.store.saveEvaluation(input, result);
  }

  evaluateCoverageRequirements(input: RequirementEvaluationRequest) {
    return {
      conformance: false,
      productionConformance: false,
      mode: "local-non-conformant",
      boundary: "crd",
      result: this.evaluate(input)
    };
  }

  services(): CdsServicesResponse {
    return {
      conformance: false,
      productionConformance: false,
      mode: "local-non-conformant",
      services: (Object.keys(CRD_SERVICE_IDS) as CdsHooksPrimaryHook[]).map((hook) => ({
        hook,
        id: CRD_SERVICE_IDS[hook],
        title: `Open Prior Auth ${hook} fixture service`,
        description: "Synthetic CRD coverage-information fixture harness for MRI lumbar spine prior authorization.",
        prefetch: {
          patient: "Patient/{{context.patientId}}"
        }
      }))
    };
  }

  evaluateCdsService(serviceId: string, input: CdsHooksRequest): CdsHooksResponse {
    const hook = hookFromServiceId(serviceId);
    if (!hook) {
      throw new OperationOutcomeError(404, "not-found", `CDS service not found: ${serviceId}`);
    }
    assertCdsRequest(input, hook);
    const request = standardsRequirementRequest(input);
    const result = this.evaluate(request);
    return {
      conformance: false,
      productionConformance: false,
      mode: "local-non-conformant",
      cards: [],
      systemActions: [
        {
          type: "create",
          description: "Create local CRD coverage-information fixture response.",
          resource: coverageInformationResource(hook, result, request)
        }
      ]
    };
  }
}

export class LocalDtrAdapter {
  readonly conformance = "local-dtr-inspired-not-questionnaire-package" as const;
  readonly boundary = {
    boundary: "dtr" as const,
    conformance: false as const,
    productionConformance: false as const,
    mode: "local-non-conformant" as const,
    contractVersion: "m8.dtr-questionnaire-package-fixture.v1",
    notes: ["FHIR Questionnaire/$questionnaire-package fixture harness returning packagebundle Parameters. Not production DTR conformance."]
  };
  private readonly service: QuestionnaireService;

  constructor(
    private readonly repository: FixtureFhirRepository,
    private readonly store: PriorAuthStore
  ) {
    this.service = new QuestionnaireService(repository, store);
  }

  getPackage(input: QuestionnairePackageRequest) {
    return this.service.getPackage(input.workItemId);
  }

  saveResponse(input: QuestionnaireResponseSaveRequest) {
    return this.service.saveResponse(input);
  }

  getStandardsPackage(input: QuestionnairePackageRequest) {
    return this.service.getStandardsPackage(input.workItemId);
  }

  evaluateFixtureExpression(input: { workItemId: string; expressionName: string }) {
    return {
      conformance: false,
      productionConformance: false,
      mode: "local-non-conformant",
      boundary: "dtr",
      evaluation: this.service.evaluateFixtureExpression(input.workItemId, input.expressionName)
    };
  }

  questionnairePackageOperation(input: FhirParameters): FhirParameters {
    assertParameters(input, "DTR questionnaire package input must be a FHIR Parameters resource.");
    const workItem = this.resolveWorkItem(input);
    const standardsPackage = this.service.getStandardsPackage(workItem.id);
    const bundle = standardsPackage.response.parameter.find((parameter) => parameter.name === "return")?.resource;
    if (!isFhirBundle(bundle)) {
      throw new OperationOutcomeError(422, "processing", `Could not build DTR package Bundle for work item ${workItem.id}.`);
    }
    return {
      resourceType: "Parameters",
      parameter: [
        {
          name: "packagebundle",
          resource: {
            ...bundle,
            type: "collection"
          }
        }
      ]
    };
  }

  private resolveWorkItem(input: FhirParameters): WorkItem {
    const localWorkItemId = valueStringParameter(input, "workItemId");
    if (localWorkItemId) {
      const workItem = this.store.getWorkItem(localWorkItemId);
      if (!workItem) {
        throw new OperationOutcomeError(422, "not-found", `DTR workItemId could not be resolved: ${localWorkItemId}`);
      }
      return workItem;
    }

    const request = standardsRequirementRequestFromParameters(input);
    const result = this.store.saveEvaluation(request, evaluateRequirement(request, this.repository));
    return this.store.createWorkItem({
      evaluationId: result.evaluationId,
      ownerUserId: "m8-standards-harness"
    });
  }
}

export class LocalPasAdapter {
  readonly conformance = "local-pas-style-mock-not-da-vinci-pas" as const;
  readonly boundary = {
    boundary: "pas" as const,
    conformance: false as const,
    productionConformance: false as const,
    mode: "local-non-conformant" as const,
    contractVersion: "m8.pas-claim-submit-fixture.v1",
    notes: ["FHIR Claim/$submit fixture harness around local PAS-style bundles. No X12, payer auth, endpoint discovery, or real payer transport."]
  };
  private readonly service: SubmissionService;

  constructor(repository: FixtureFhirRepository, store: PriorAuthStore) {
    this.service = new SubmissionService(repository, store);
  }

  buildPacket(input: PacketBuildRequest) {
    return this.service.buildPacket(input);
  }

  submitPacket(input: PacketSubmitRequest) {
    return this.service.submitPacket(input);
  }

  buildSubmission(input: PacketBuildRequest) {
    return {
      conformance: false,
      productionConformance: false,
      mode: "local-non-conformant",
      boundary: "pas",
      packet: this.buildPacket(input)
    };
  }

  submit(input: PacketSubmitRequest) {
    return {
      conformance: false,
      productionConformance: false,
      mode: "local-non-conformant",
      boundary: "pas",
      receipt: this.submitPacket(input)
    };
  }

  claimSubmitOperation(input: FhirBundle): FhirBundle {
    if (!isFhirBundle(input)) {
      throw new OperationOutcomeError(400, "required", "PAS Claim/$submit input must be a FHIR Bundle resource.");
    }
    const claim = input.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource;
    if (!claim) {
      throw new OperationOutcomeError(422, "required", "PAS Claim/$submit Bundle must contain one Claim resource.");
    }
    const packetId = packetIdFromBundle(input);
    if (!packetId) {
      throw new OperationOutcomeError(422, "not-supported", "PAS Claim/$submit Bundle must be a generated local packet Bundle with id bundle-packet-*.");
    }
    const receipt = this.submitPacket({ packetId, actorUserId: "m8-standards-harness" });
    return receipt.responseBundle;
  }
}

export function createLocalStandardsAdapters(repository: FixtureFhirRepository, store: PriorAuthStore) {
  const adapters = {
    launch: new LocalLaunchAdapter(repository),
    crd: new LocalCrdAdapter(repository, store),
    dtr: new LocalDtrAdapter(repository, store),
    pas: new LocalPasAdapter(repository, store)
  };
  return {
    ...adapters,
    boundaries(): LocalStandardsBoundaryResponse {
      return {
        conformance: false,
        mode: "local-non-conformant",
        boundaries: [
          adapters.launch.boundary,
          adapters.crd.boundary,
          adapters.dtr.boundary,
          adapters.pas.boundary,
          {
            boundary: "evidence",
            conformance: false,
            productionConformance: false,
            mode: "local-non-conformant",
            contractVersion: "m8.local-evidence-boundary.v1",
            notes: ["Local synthetic evidence metadata and file storage. Not production FHIR persistence or document management."]
          }
        ],
        productionConformance: false
      };
    }
  };
}

export type LocalStandardsAdapters = ReturnType<typeof createLocalStandardsAdapters>;

function hookFromServiceId(serviceId: string): CdsHooksPrimaryHook | null {
  const match = (Object.entries(CRD_SERVICE_IDS) as Array<[CdsHooksPrimaryHook, string]>)
    .find(([, candidate]) => candidate === serviceId);
  return match?.[0] ?? null;
}

function assertCdsRequest(input: CdsHooksRequest, expectedHook: CdsHooksPrimaryHook): void {
  if (!input || typeof input !== "object") {
    throw new OperationOutcomeError(400, "required", "CDS Hooks request body is required.");
  }
  if (input.hook !== expectedHook) {
    throw new OperationOutcomeError(422, "invalid", `CDS Hooks request hook must be ${expectedHook}.`);
  }
  if (!input.hookInstance || !input.context || typeof input.context !== "object") {
    throw new OperationOutcomeError(400, "required", "CDS Hooks request requires hookInstance and context.");
  }
}

function standardsRequirementRequest(input: CdsHooksRequest): RequirementEvaluationRequest {
  const context = input.context ?? {};
  const patientId = requiredString(context.patientId, "CDS Hooks context.patientId is required.");
  const coverageId = requiredString(context.coverageId, "CDS Hooks context.coverageId is required.");
  const requestResourceId = stringValue(context.orderId)
    ?? stringValue(context.requestResourceId)
    ?? requestIdFromPrefetch(input.prefetch);
  if (!requestResourceId) {
    throw new OperationOutcomeError(400, "required", "CDS Hooks context.orderId, context.requestResourceId, or prefetch draft ServiceRequest is required.");
  }
  const payerId = stringValue(context.payerId) ?? DEFAULT_STANDARDS_REQUEST.payerId;
  const serviceLine = stringValue(context.serviceLine) ?? DEFAULT_STANDARDS_REQUEST.serviceLine;
  if (patientId !== DEFAULT_STANDARDS_REQUEST.patientId || coverageId !== DEFAULT_STANDARDS_REQUEST.coverageId || requestResourceId !== DEFAULT_STANDARDS_REQUEST.requestResourceId) {
    throw new OperationOutcomeError(422, "not-supported", "M8 standards fixture harness only maps the synthetic MRI lumbar spine patient, coverage, and ServiceRequest.");
  }
  return {
    patientId,
    coverageId,
    requestResourceType: "ServiceRequest",
    requestResourceId,
    serviceLine,
    payerId
  };
}

function standardsRequirementRequestFromParameters(input: FhirParameters): RequirementEvaluationRequest {
  const patientId = requiredParameter(input, "patientId");
  const coverageId = requiredParameter(input, "coverageId");
  const requestResourceId = valueStringParameter(input, "requestResourceId") ?? orderIdFromParameters(input);
  if (!requestResourceId) {
    throw new OperationOutcomeError(400, "required", "DTR questionnaire package Parameters requires requestResourceId or an order resource parameter.");
  }
  if (patientId !== DEFAULT_STANDARDS_REQUEST.patientId || coverageId !== DEFAULT_STANDARDS_REQUEST.coverageId || requestResourceId !== DEFAULT_STANDARDS_REQUEST.requestResourceId) {
    throw new OperationOutcomeError(422, "not-supported", "DTR questionnaire package input could not be mapped to the synthetic MRI lumbar spine fixture.");
  }
  return {
    ...DEFAULT_STANDARDS_REQUEST,
    patientId,
    coverageId,
    requestResourceId
  };
}

function coverageInformationResource(
  hook: CdsHooksPrimaryHook,
  result: RequirementEvaluationResult,
  request: RequirementEvaluationRequest
): Record<string, unknown> {
  return {
    resourceType: "CoverageEligibilityResponse",
    id: `crd-${hook}-${result.evaluationId}`,
    status: "active",
    purpose: ["auth-requirements"],
    patient: { reference: `Patient/${request.patientId}` },
    insurer: {
      identifier: {
        system: "http://openpriorauth.local/payer-id",
        value: request.payerId
      }
    },
    insurance: [
      {
        coverage: { reference: `Coverage/${request.coverageId}` },
        inforce: true
      }
    ],
    extension: [
      {
        url: "http://hl7.org/fhir/us/davinci-crd/StructureDefinition/ext-coverage-information",
        extension: [
          {
            url: "pa-needed",
            valueBoolean: result.requiresPriorAuth
          },
          {
            url: "doc-needed",
            valueBoolean: result.requiresDocs
          },
          {
            url: "questionnaire",
            valueUri: result.questionnaireCanonicals[0]
          },
          {
            url: "coverage-info",
            valueString: result.explanatoryNotes.join(" ")
          }
        ].filter((item) => item.valueBoolean !== undefined || item.valueUri || item.valueString)
      },
      {
        url: "http://openpriorauth.local/fhir/StructureDefinition/m8-fixture-harness",
        valueString: "productionConformance=false"
      }
    ]
  };
}

function assertParameters(input: FhirParameters, message: string): void {
  if (!input || input.resourceType !== "Parameters") {
    throw new OperationOutcomeError(400, "required", message);
  }
}

function valueStringParameter(input: FhirParameters, name: string): string | null {
  const parameter = input.parameter?.find((candidate) => candidate.name === name);
  return typeof parameter?.valueString === "string" && parameter.valueString ? parameter.valueString : null;
}

function requiredParameter(input: FhirParameters, name: string): string {
  const value = valueStringParameter(input, name);
  if (!value) {
    throw new OperationOutcomeError(400, "required", `DTR questionnaire package Parameters requires ${name}.`);
  }
  return value;
}

function orderIdFromParameters(input: FhirParameters): string | null {
  const order = input.parameter?.find((parameter) => parameter.name === "order" && parameter.resource)?.resource;
  return typeof order?.id === "string" ? order.id : null;
}

function requestIdFromPrefetch(prefetch: Record<string, unknown> | undefined): string | null {
  const bundle = prefetch?.draftOrders;
  if (!isFhirBundle(bundle)) {
    return null;
  }
  const request = bundle.entry.find((entry) => entry.resource.resourceType === "ServiceRequest")?.resource;
  return typeof request?.id === "string" ? request.id : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function requiredString(value: unknown, message: string): string {
  const candidate = stringValue(value);
  if (!candidate) {
    throw new OperationOutcomeError(400, "required", message);
  }
  return candidate;
}

function packetIdFromBundle(bundle: FhirBundle): string | null {
  if (bundle.id?.startsWith("bundle-packet-")) {
    return bundle.id.replace(/^bundle-/, "");
  }
  return null;
}

function isFhirBundle(value: unknown): value is FhirBundle {
  return Boolean(value)
    && typeof value === "object"
    && (value as { resourceType?: unknown }).resourceType === "Bundle"
    && Array.isArray((value as { entry?: unknown }).entry);
}
