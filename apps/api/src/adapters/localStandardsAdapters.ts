import type {
  LocalStandardsBoundaryResponse,
  PacketBuildRequest,
  PacketSubmitRequest,
  QuestionnairePackageRequest,
  QuestionnaireResponseSaveRequest,
  RequirementEvaluationRequest
} from "@open-prior-auth/shared-types";
import { evaluateRequirement } from "../evaluation/evaluate.js";
import { FixtureFhirRepository } from "../fhir/fixtureRepository.js";
import { QuestionnaireService } from "../questionnaires/questionnaireService.js";
import { type PriorAuthStore } from "../storage/priorAuthStore.js";
import { SubmissionService } from "../submissions/submissionService.js";

export class LocalLaunchAdapter {
  readonly conformance = "local-launch-shim-not-smart" as const;
  readonly boundary = {
    boundary: "smart" as const,
    conformance: false as const,
    mode: "local-non-conformant" as const,
    contractVersion: "m7.local-smart-boundary.v1",
    notes: ["Mock discovery and launch context only. No production OAuth, scopes, token validation, or EHR launch."]
  };

  constructor(private readonly repository: FixtureFhirRepository) {}

  getPatientContext(patientId: string) {
    return this.repository.getPatientContext(patientId);
  }

  smartConfiguration() {
    return {
      conformance: false,
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
    mode: "local-non-conformant" as const,
    contractVersion: "m7.local-crd-boundary.v1",
    notes: ["CDS Hooks-shaped alias around the local deterministic evaluator. Not a CDS Hooks CRD implementation."]
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
      mode: "local-non-conformant",
      boundary: "crd",
      result: this.evaluate(input)
    };
  }
}

export class LocalDtrAdapter {
  readonly conformance = "local-dtr-inspired-not-questionnaire-package" as const;
  readonly boundary = {
    boundary: "dtr" as const,
    conformance: false as const,
    mode: "local-non-conformant" as const,
    contractVersion: "m7.local-dtr-boundary.v1",
    notes: ["Parameters-shaped local package with fixture dependencies. Not a Da Vinci DTR $questionnaire-package implementation."]
  };
  private readonly service: QuestionnaireService;

  constructor(repository: FixtureFhirRepository, store: PriorAuthStore) {
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
      mode: "local-non-conformant",
      boundary: "dtr",
      evaluation: this.service.evaluateFixtureExpression(input.workItemId, input.expressionName)
    };
  }
}

export class LocalPasAdapter {
  readonly conformance = "local-pas-style-mock-not-da-vinci-pas" as const;
  readonly boundary = {
    boundary: "pas" as const,
    conformance: false as const,
    mode: "local-non-conformant" as const,
    contractVersion: "m7.local-pas-boundary.v1",
    notes: ["PAS-shaped alias around local packet build and mock submit. No Da Vinci PAS, X12, payer auth, or endpoint discovery."]
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
      mode: "local-non-conformant",
      boundary: "pas",
      packet: this.buildPacket(input)
    };
  }

  submit(input: PacketSubmitRequest) {
    return {
      conformance: false,
      mode: "local-non-conformant",
      boundary: "pas",
      receipt: this.submitPacket(input)
    };
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
            mode: "local-non-conformant",
            contractVersion: "m7.local-evidence-boundary.v1",
            notes: ["Local synthetic evidence metadata and file storage. Not production FHIR persistence or document management."]
          }
        ]
      };
    }
  };
}

export type LocalStandardsAdapters = ReturnType<typeof createLocalStandardsAdapters>;
