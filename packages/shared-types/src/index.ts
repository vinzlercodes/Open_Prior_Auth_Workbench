export type RequestResourceType = "ServiceRequest" | "MedicationRequest" | "DeviceRequest";

export type ServiceLine = "mri_lumbar_spine" | "dme_power_wheelchair";

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
    | "review_ready"
    | "packet_ready"
    | "submitted"
    | "more_info_needed"
    | "approved"
    | "denied"
    | "cancelled"
    | "submission_failed";
  createdAt: string;
  requirementResult: RequirementEvaluationResult;
}

export type PayerUpdateStatus = "pended" | "approved" | "denied" | "cancelled";

export type EffectiveOperationsStatus = WorkItem["status"] | "pended";

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
  sourceResourceType: "Patient" | "Coverage" | "ServiceRequest" | "MedicationRequest" | "DeviceRequest" | "Condition" | "Observation";
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

export interface LocalDtrExpressionEvaluation {
  expressionName: string;
  language: "text/cql-identifier";
  result: unknown;
  source: "fixture-allowlist";
}

export interface LocalDtrStandardsPackage {
  conformance: false;
  mode: "local-non-conformant";
  boundary: "dtr";
  contractVersion: "m7.local-dtr-boundary.v1";
  response: {
    resourceType: "Parameters";
    parameter: Array<{
      name: string;
      resource?: FhirBundle | FhirQuestionnaire | FhirQuestionnaireResponse | Record<string, unknown>;
      valueString?: string;
      part?: Array<{
        name: string;
        resource?: FhirBundle | FhirQuestionnaire | FhirQuestionnaireResponse | Record<string, unknown>;
        valueString?: string;
      }>;
    }>;
  };
  expressionEvaluations: LocalDtrExpressionEvaluation[];
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

export interface FhirBundle {
  resourceType: "Bundle";
  id: string;
  type: string;
  timestamp?: string;
  entry: Array<{
    fullUrl?: string;
    resource: {
      resourceType: string;
      id?: string;
      [key: string]: unknown;
    };
  }>;
}

export interface FhirParameters {
  resourceType: "Parameters";
  parameter?: Array<{
    name: string;
    resource?: FhirBundle | FhirQuestionnaire | FhirQuestionnaireResponse | Record<string, unknown>;
    valueString?: string;
    valueUri?: string;
    valueBoolean?: boolean;
    part?: Array<{
      name: string;
      resource?: FhirBundle | FhirQuestionnaire | FhirQuestionnaireResponse | Record<string, unknown>;
      valueString?: string;
      valueUri?: string;
      valueBoolean?: boolean;
    }>;
  }>;
}

export interface SmartDiscoveryMetadata {
  conformance: false;
  productionConformance: false;
  mode: "local-non-conformant";
  authorization_endpoint: string;
  token_endpoint: string;
  capabilities: string[];
  scopes_supported: string[];
}

export type CdsHooksPrimaryHook = "appointment-book" | "order-dispatch" | "order-sign";

export interface CdsServiceDescriptor {
  hook: CdsHooksPrimaryHook;
  id: string;
  title: string;
  description: string;
  prefetch?: Record<string, string>;
}

export interface CdsServicesResponse {
  services: CdsServiceDescriptor[];
  conformance: false;
  productionConformance: false;
  mode: "local-non-conformant";
}

export interface CdsHooksRequest {
  hook: CdsHooksPrimaryHook;
  hookInstance: string;
  fhirServer?: string;
  context: Record<string, unknown>;
  prefetch?: Record<string, unknown>;
}

export interface CdsHooksResponse {
  cards: Array<Record<string, unknown>>;
  systemActions: Array<Record<string, unknown>>;
  conformance: false;
  productionConformance: false;
  mode: "local-non-conformant";
}

export interface SubmissionPacketSnapshot {
  workItemId: string;
  questionnaireResponseId: string;
  questionnaireResponseRevision: number;
  payerId: string;
  packetSchemaVersion: SubmissionPacketSchemaVersion;
  evidenceAttachmentIds?: string[];
  evidenceDigest?: string;
}

export type SubmissionPacketSchemaVersion = "m3.local-pas-style.v1" | "m7.local-pas-evidence.v1";

export type EvidenceContentMode = "inline-base64" | "local-binary" | "local-reference" | "bundle-fixture";

export type EvidenceStatus = "available" | "attached" | "accepted" | "removed" | "included-in-packet";

export interface EvidenceAttachment {
  id: string;
  workItemId: string;
  source: "fixture" | "upload";
  fixtureId?: string;
  status: EvidenceStatus;
  contentMode: EvidenceContentMode;
  title: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  storageKey?: string;
  inlineBase64?: string;
  documentReference: Record<string, unknown>;
  binary?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  acceptedAt?: string;
  removedAt?: string;
  includedInPacketId?: string;
}

export interface EvidenceFixtureSummary {
  fixtureId: string;
  title: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  contentMode: EvidenceContentMode;
}

export interface AttachEvidenceRequest {
  fixtureId: string;
  actorUserId?: string;
}

export interface UploadEvidenceRequest {
  filename: string;
  contentType: string;
  base64Data: string;
  sha256?: string;
  title?: string;
  actorUserId?: string;
}

export interface EvidenceListResponse {
  conformance: false;
  mode: "local-non-conformant";
  workItemId: string;
  availableFixtures: EvidenceFixtureSummary[];
  attachments: EvidenceAttachment[];
}

export interface SubmissionAttachmentManifestEntry {
  evidenceAttachmentId: string;
  documentReferenceId: string;
  binaryId?: string;
  title: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  sha256: string;
  contentMode: EvidenceContentMode;
  source: "fixture" | "upload";
}

export interface SubmissionAttachmentManifest {
  attachments: SubmissionAttachmentManifestEntry[];
  evidenceDigest?: string;
  missingFixtureReason?: "No document fixtures in M3" | "No accepted evidence attachments";
}

export interface SubmissionPacket {
  id: string;
  workItemId: string;
  packetSchemaVersion: SubmissionPacketSchemaVersion;
  builtAt: string;
  transport: "mock-pas";
  bundle: FhirBundle;
  attachmentManifest: SubmissionAttachmentManifest;
  snapshot: SubmissionPacketSnapshot;
}

export interface SubmissionReceipt {
  packetId: string;
  receiptId: string;
  trackingId: string;
  submittedAt: string;
  transport: "mock-pas";
  idempotent: boolean;
  responseBundle: FhirBundle;
}

export interface DenialReason {
  code: string;
  display: string;
  detail: string;
  source: "mock-payer";
}

export interface PayerUpdate {
  id: string;
  workItemId: string;
  status: PayerUpdateStatus;
  actor: "user" | "mock-payer" | "system";
  createdAt: string;
  submittedAt: string;
  decidedAt?: string;
  decisionTimeMs?: number;
  reason?: DenialReason;
  message?: string;
}

export interface MoreInfoRequestedItem {
  code: string;
  label: string;
  required: boolean;
}

export interface MoreInfoRequest {
  id: string;
  workItemId: string;
  message: string;
  requestedItems: MoreInfoRequestedItem[];
  dueAt?: string;
  requestedAt: string;
  resolvedAt?: string;
}

export type OperationEventType =
  | "payer_status_recorded"
  | "more_info_requested"
  | "more_info_resolved"
  | "case_assigned"
  | "case_cancelled"
  | "evidence_attached"
  | "evidence_uploaded"
  | "evidence_accepted"
  | "evidence_removed"
  | "evidence_included_in_packet";

export interface OperationEvent {
  id: string;
  workItemId: string;
  type: OperationEventType;
  actor: "user" | "mock-payer" | "system";
  createdAt: string;
  details: unknown;
}

export interface WorkItemQueueRow {
  workItemId: string;
  patientName: string;
  payerName: string;
  serviceDescription: string;
  ownerUserId: string | null;
  status: WorkItem["status"];
  effectiveStatus: EffectiveOperationsStatus;
  createdAt: string;
  ageMs: number;
  lastTransitionAt: string;
  lastTransitionAgeMs: number;
  submittedAt?: string;
  decidedAt?: string;
  decisionTimeMs?: number;
  latestPayerUpdate?: PayerUpdate;
  latestMoreInfoRequest?: MoreInfoRequest;
  nextAction: string;
}

export interface WorkItemQueueQuery {
  status?: string;
  owner?: string;
  sort?: "age_desc" | "age_asc" | "updated_desc" | "updated_asc";
}

export interface OperationsMetrics {
  generatedAt: string;
  totalWorkItems: number;
  openWorkItems: number;
  terminalWorkItems: number;
  countsByStatus: Record<string, number>;
  countsByEffectiveStatus: Record<string, number>;
  agingBuckets: {
    under1Hour: number;
    oneTo24Hours: number;
    over24Hours: number;
  };
  medianTimeToReviewReadyMs: number | null;
  submittedCount: number;
  moreInfoCount: number;
  deniedCount: number;
  averageSubmissionToDecisionMs: number | null;
  medianSubmissionToDecisionMs: number | null;
  approvalRate: number;
  denialRate: number;
  moreInfoRate: number;
  pendedRate: number;
  standardVsExpeditedBreakdown?: Record<string, {
    submitted: number;
    decided: number;
    averageSubmissionToDecisionMs: number | null;
    medianSubmissionToDecisionMs: number | null;
  }>;
}

export interface PayerStatusRecordRequest {
  status: PayerUpdateStatus;
  actor?: "user" | "mock-payer" | "system";
  reason?: Omit<DenialReason, "source"> & { source?: "mock-payer" };
  message?: string;
}

export interface MoreInfoRequestCreateRequest {
  message: string;
  requestedItems: MoreInfoRequestedItem[];
  dueAt?: string;
  actor?: "user" | "mock-payer" | "system";
}

export interface WorkItemOperationsHistory {
  workItemId: string;
  payerUpdates: PayerUpdate[];
  moreInfoRequests: MoreInfoRequest[];
  operationEvents: OperationEvent[];
}

export interface AgentCockpitTraceEvent {
  sequence: number;
  eventId: string;
  runId: string;
  taskId?: string;
  toolCallId?: string;
  approvalRequestId?: string;
  type: string;
  actor: string;
  at: string;
  message: string;
  data: unknown;
}

export interface AgentCockpitStep {
  agent: "orchestrator" | "requirement" | "documentation" | "evidence" | "packet" | "compliance";
  toolName?: string;
  status: "completed" | "waiting_for_human";
  summary: string;
}

export interface AgentCockpitApprovalSummary {
  id: string;
  toolName: string;
  riskLevel: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
}

export interface AgentCockpitRequirementEvidenceRow {
  requirementCode: string;
  requirementLabel: string;
  requirementDetail: string;
  resourceType: string;
  status: "satisfied" | "missing" | "available" | "attached" | "accepted" | "included-in-packet";
  sourceLabel: string;
  evidenceAttachmentIds: string[];
  fixtureIds: string[];
}

export interface AgentCockpitRunResponse {
  run: {
    id: string;
    status: "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
    objective: string;
    createdAt: string;
    updatedAt: string;
    completedAt?: string;
    metadata: Record<string, unknown>;
  };
  workItem: WorkItem;
  caseStatus: WorkItem["status"];
  requirementEvaluation: RequirementEvaluationResult;
  questionnairePackage: QuestionnairePackage;
  evidence: EvidenceListResponse;
  evidenceBoard: AgentCockpitRequirementEvidenceRow[];
  packet: SubmissionPacket;
  receipt: SubmissionReceipt | null;
  questionnaireApproval: AgentCockpitApprovalSummary;
  submitApproval: AgentCockpitApprovalSummary;
  steps: AgentCockpitStep[];
  trace: AgentCockpitTraceEvent[];
  statusTimeline: StatusEvent[];
  auditTrace: AuditEvent[];
}

export interface PacketBuildRequest {
  workItemId: string;
  actorUserId?: string;
}

export interface PacketSubmitRequest {
  packetId: string;
  actorUserId?: string;
}

export interface LocalStandardsBoundaryDescriptor {
  boundary: "smart" | "crd" | "dtr" | "pas" | "evidence";
  conformance: false;
  mode: "local-non-conformant";
  contractVersion: string;
  notes: string[];
}

export interface LocalStandardsBoundaryResponse {
  conformance: false;
  mode: "local-non-conformant";
  boundaries: LocalStandardsBoundaryDescriptor[];
}

export interface StatusEvent {
  eventId: string;
  workItemId: string;
  fromStatus: WorkItem["status"] | null;
  toStatus: WorkItem["status"];
  actor: string;
  at: string;
  causedBy: string;
  packetId?: string;
  receiptId?: string;
}

export interface AuditEvent {
  eventId: string;
  sequence: number;
  actor: string;
  action: string;
  resourceType: string;
  resourceId: string;
  timestamp: string;
  beforeJson: unknown | null;
  afterJson: unknown | null;
  workItemId?: string;
  packetId?: string;
  receiptId?: string;
}
