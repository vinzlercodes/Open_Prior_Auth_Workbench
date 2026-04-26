import type {
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

  constructor(private readonly repository: FixtureFhirRepository) {}

  getPatientContext(patientId: string) {
    return this.repository.getPatientContext(patientId);
  }
}

export class LocalCrdAdapter {
  readonly conformance = "local-crd-inspired-not-cds-hooks" as const;

  constructor(
    private readonly repository: FixtureFhirRepository,
    private readonly store: PriorAuthStore
  ) {}

  evaluate(input: RequirementEvaluationRequest) {
    const result = evaluateRequirement(input, this.repository);
    return this.store.saveEvaluation(input, result);
  }
}

export class LocalDtrAdapter {
  readonly conformance = "local-dtr-inspired-not-questionnaire-package" as const;
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
}

export class LocalPasAdapter {
  readonly conformance = "local-pas-style-mock-not-da-vinci-pas" as const;
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
}

export function createLocalStandardsAdapters(repository: FixtureFhirRepository, store: PriorAuthStore) {
  return {
    launch: new LocalLaunchAdapter(repository),
    crd: new LocalCrdAdapter(repository, store),
    dtr: new LocalDtrAdapter(repository, store),
    pas: new LocalPasAdapter(repository, store)
  };
}

export type LocalStandardsAdapters = ReturnType<typeof createLocalStandardsAdapters>;
