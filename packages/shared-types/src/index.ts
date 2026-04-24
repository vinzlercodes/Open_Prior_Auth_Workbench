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
  status: "draft" | "requirements_found" | "not_required" | "needs_baseline_data";
  createdAt: string;
  requirementResult: RequirementEvaluationResult;
}
