import type {
  AuditEvent,
  EvidenceListResponse,
  PacketBuildRequest,
  PacketSubmitRequest,
  QuestionnairePackage,
  QuestionnaireResponseSaveRequest,
  RequirementEvaluationRequest,
  RequirementEvaluationResult,
  StatusEvent,
  SubmissionPacket,
  WorkItemQueueQuery,
  WorkItemQueueRow
} from "@open-prior-auth/shared-types";
import type {
  ClinicalContextRepository,
  PriorAuthorizationCase,
  PriorAuthStore
} from "@open-prior-auth/prior-auth-core";

export type DoctorToolName =
  | "doctor.case.get"
  | "doctor.queue.list_work_items"
  | "doctor.case.get_status_timeline"
  | "doctor.case.get_audit_trace"
  | "doctor.evidence.list"
  | "doctor.requirements.evaluate"
  | "doctor.dtr.get_questionnaire_package"
  | "doctor.pas.build_packet"
  | "doctor.dtr.save_response"
  | "doctor.pas.submit_mock";

export type DoctorToolCategory = "case" | "queue" | "evidence" | "requirements" | "dtr" | "pas";

export type DoctorToolRiskLevel = "read" | "draft" | "guarded_write" | "guarded_submit";

export type DoctorToolCallStatus = "succeeded" | "failed" | "blocked";

export interface DoctorToolApprovalMetadata {
  approvalRequired: boolean;
  reason?: string;
  blockedCode?: string;
}

export interface DoctorToolSchema {
  type: "object" | "array" | "string" | "number" | "boolean" | "null";
  description?: string;
  required?: string[];
  properties?: Record<string, DoctorToolSchema>;
  items?: DoctorToolSchema;
  enum?: string[];
  additionalProperties?: boolean | DoctorToolSchema;
}

export interface DoctorToolDefinition {
  name: DoctorToolName;
  category: DoctorToolCategory;
  description: string;
  riskLevel: DoctorToolRiskLevel;
  approval: DoctorToolApprovalMetadata;
  executable: boolean;
  inputSchema: DoctorToolSchema;
  outputSchema: DoctorToolSchema;
}

export interface DoctorToolCallRecord {
  callId: string;
  toolName: DoctorToolName;
  category: DoctorToolCategory;
  riskLevel: DoctorToolRiskLevel;
  approvalRequired: boolean;
  status: DoctorToolCallStatus;
  startedAt: string;
  completedAt: string;
  input: unknown;
  output?: unknown;
  error?: DoctorToolError;
}

export interface DoctorToolError {
  code: string;
  message: string;
  details?: unknown;
}

export type DoctorToolOutput =
  | PriorAuthorizationCase
  | WorkItemQueueRow[]
  | StatusEvent[]
  | AuditEvent[]
  | EvidenceListResponse
  | RequirementEvaluationResult
  | QuestionnairePackage
  | SubmissionPacket;

export type DoctorToolExecutionResult =
  | {
      ok: true;
      output: DoctorToolOutput;
      record: DoctorToolCallRecord;
    }
  | {
      ok: false;
      error: DoctorToolError;
      record: DoctorToolCallRecord;
    };

export interface DoctorToolClock {
  nowIso(): string;
}

export interface DoctorToolIdGenerator {
  generateId(prefix?: string): string;
}

export interface DoctorToolDependencies {
  store: PriorAuthStore;
  repository: ClinicalContextRepository;
  uploadDirectory?: string;
  clock?: DoctorToolClock;
  idGenerator?: DoctorToolIdGenerator;
}

export interface DoctorToolCallContext {
  actorUserId?: string;
  agentRunId?: string;
  agentTaskId?: string;
}

export type DoctorToolInputByName = {
  "doctor.case.get": { workItemId: string };
  "doctor.queue.list_work_items": { query?: WorkItemQueueQuery };
  "doctor.case.get_status_timeline": { workItemId: string };
  "doctor.case.get_audit_trace": { workItemId: string };
  "doctor.evidence.list": { workItemId: string };
  "doctor.requirements.evaluate": { request: RequirementEvaluationRequest };
  "doctor.dtr.get_questionnaire_package": { workItemId: string };
  "doctor.pas.build_packet": PacketBuildRequest;
  "doctor.dtr.save_response": QuestionnaireResponseSaveRequest;
  "doctor.pas.submit_mock": PacketSubmitRequest;
};

export interface DoctorToolExecutionRequest<Name extends DoctorToolName = DoctorToolName> {
  toolName: Name;
  input: DoctorToolInputByName[Name];
  callContext?: DoctorToolCallContext;
}

export interface DoctorToolRegistry {
  listTools(): readonly DoctorToolDefinition[];
  getToolDefinition(name: DoctorToolName): DoctorToolDefinition;
  executeTool<Name extends DoctorToolName>(
    request: DoctorToolExecutionRequest<Name>
  ): Promise<DoctorToolExecutionResult>;
}
