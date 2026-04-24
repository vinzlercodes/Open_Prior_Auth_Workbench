export type RequestResourceType = "ServiceRequest" | "MedicationRequest" | "DeviceRequest";

export type ServiceLine = "mri_lumbar_spine";

export type EvaluationStatus =
  | "requirements_found"
  | "not_required"
  | "needs_baseline_data"
  | "unsupported_service_line"
  | "evaluation_error";

export type NextAction =
  | "create_work_item"
  | "collect_baseline_data"
  | "no_prior_auth_needed"
  | "select_supported_service_line"
  | "review_error";

export type Determinism = "deterministic";

export interface RequirementEvaluationRequest {
  patientId: string;
  coverageId: string;
  requestResourceType: RequestResourceType;
  requestResourceId: string;
  serviceLine: string;
  payerId: string;
}

export interface MissingDataReason {
  code: string;
  label: string;
  resourceType: string;
  detail: string;
}

export interface RequestSummary {
  patientName: string;
  serviceDescription: string;
  payerName: string;
  diagnosisSummary?: string;
  evidenceSummary?: string;
}

export interface RequirementEvaluationResult {
  evaluationId: string;
  evaluationStatus: EvaluationStatus;
  requiresPriorAuth: boolean;
  requiresDocs: boolean;
  matchedRuleId: string | null;
  rulePackVersion: string | null;
  nextAction: NextAction;
  determinism: Determinism;
  requestSummary: RequestSummary;
  questionnaireCanonicals: string[];
  missingData: MissingDataReason[];
  explanatoryNotes: string[];
}

export interface WorkItemCreateRequest {
  evaluationId: string;
  ownerUserId?: string;
}

export interface WorkItem {
  id: string;
  evaluationId: string;
  patientId: string;
  coverageId: string;
  requestResourceType: RequestResourceType;
  requestResourceId: string;
  serviceLine: string;
  payerId: string;
  ownerUserId: string | null;
  status:
    | "draft"
    | "requirements_found"
    | "not_required"
    | "needs_baseline_data"
    | "questionnaire_in_progress"
    | "review_ready";
  createdAt: string;
  requirementResult: RequirementEvaluationResult;
}

export interface FhirReference {
  reference?: string;
  display?: string;
  identifier?: {
    system?: string;
    value?: string;
  };
}

export interface FhirCoding {
  system?: string;
  code?: string;
  display?: string;
}

export interface FhirCodeableConcept {
  coding?: FhirCoding[];
  text?: string;
}

export interface FhirExtension {
  url: string;
  valueString?: string;
  valueReference?: FhirReference;
}

export type QuestionnaireItemType =
  | "group"
  | "display"
  | "boolean"
  | "decimal"
  | "integer"
  | "date"
  | "dateTime"
  | "time"
  | "string"
  | "text"
  | "url"
  | "choice"
  | "open-choice";

export type QuestionnaireEnableWhenOperator = "exists" | "=" | "!=" | ">" | "<" | ">=" | "<=";

export interface FhirQuestionnaireAnswerOption {
  valueCoding?: FhirCoding;
  valueString?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
}

export interface FhirQuestionnaireEnableWhen {
  question: string;
  operator: QuestionnaireEnableWhenOperator;
  answerBoolean?: boolean;
  answerString?: string;
  answerCoding?: FhirCoding;
  answerInteger?: number;
}

export interface FhirQuestionnaireItem {
  linkId: string;
  text?: string;
  type: QuestionnaireItemType;
  required?: boolean;
  repeats?: boolean;
  answerOption?: FhirQuestionnaireAnswerOption[];
  enableWhen?: FhirQuestionnaireEnableWhen[];
  item?: FhirQuestionnaireItem[];
}

export interface FhirQuestionnaire {
  resourceType: "Questionnaire";
  id: string;
  url: string;
  version: string;
  status: string;
  title?: string;
  subjectType?: string[];
  item: FhirQuestionnaireItem[];
}

export interface FhirQuestionnaireResponseAnswer {
  valueBoolean?: boolean;
  valueDecimal?: number;
  valueInteger?: number;
  valueDate?: string;
  valueDateTime?: string;
  valueTime?: string;
  valueString?: string;
  valueUri?: string;
  valueCoding?: FhirCoding;
}

export interface FhirQuestionnaireResponseItem {
  linkId: string;
  text?: string;
  answer?: FhirQuestionnaireResponseAnswer[];
  item?: FhirQuestionnaireResponseItem[];
}

export interface FhirQuestionnaireResponse {
  resourceType: "QuestionnaireResponse";
  id: string;
  questionnaire: string;
  status: "in-progress" | "completed" | "amended" | "entered-in-error" | "stopped";
  subject?: FhirReference;
  basedOn?: FhirReference[];
  authored?: string;
  extension?: FhirExtension[];
  item: FhirQuestionnaireResponseItem[];
}

export interface LocalOperationOutcome {
  resourceType: "OperationOutcome";
  issue: Array<{
    severity: "fatal" | "error" | "warning" | "information";
    code: string;
    diagnostics: string;
  }>;
}

export interface PrefillSummary {
  linkId: string;
  sourceResourceType: "Patient" | "Coverage" | "ServiceRequest" | "Condition" | "Observation";
  sourceResourceId: string;
  sourceLabel: string;
  valueType: string;
  confidence: "deterministic";
  editable: true;
}

export interface ValidationIssue {
  severity: "error" | "warning";
  linkId: string;
  message: string;
  rule: "required" | "type" | "answer-option" | "enable-when" | "unsupported";
}

export interface QuestionnaireValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface QuestionnaireCompletion {
  requiredAnswered: number;
  requiredTotal: number;
  percentage: number;
}

export interface PrefillOverride {
  linkId: string;
  originalValue: unknown;
  currentValue: unknown;
  editedAt: string;
  actorUserId?: string;
}

export interface QuestionnaireSession {
  id: string;
  workItemId: string;
  questionnaireCanonical: string;
  questionnaireVersion: string;
  questionnaireResponse: FhirQuestionnaireResponse;
  validation: QuestionnaireValidationResult;
  status: "draft" | "review_ready";
  prefillOverrides: PrefillOverride[];
  createdAt: string;
  updatedAt: string;
  revision: number;
}

export interface QuestionnaireSessionSummary {
  status: QuestionnaireSession["status"];
  revision: number;
  createdAt: string;
  updatedAt: string;
  prefillOverrides: PrefillOverride[];
}

export interface QuestionnairePackage {
  workItemId: string;
  sessionId: string;
  questionnaireCanonical: string;
  questionnaireVersion: string;
  questionnaire: FhirQuestionnaire;
  questionnaireResponse: FhirQuestionnaireResponse;
  dependencies: {
    libraries: unknown[];
    valueSets: unknown[];
  };
  prefill: PrefillSummary[];
  validation: QuestionnaireValidationResult;
  completion: QuestionnaireCompletion;
  session: QuestionnaireSessionSummary;
  outcome?: LocalOperationOutcome;
}

export interface QuestionnairePackageRequest {
  workItemId: string;
}

export interface QuestionnaireResponseSaveRequest {
  workItemId: string;
  questionnaireResponse: FhirQuestionnaireResponse;
  revision: number;
  actorUserId?: string;
  markReadyForReview?: boolean;
}
