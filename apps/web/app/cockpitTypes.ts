import type {
  AuditEvent,
  EvidenceListResponse,
  QuestionnairePackage,
  StatusEvent,
  SubmissionPacket,
  WorkItem
} from "@open-prior-auth/shared-types";

export type AgentRunStatus = "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
export type AgentStepStatus = "pending" | "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
export type ApprovalStatus = "pending" | "approved" | "rejected";

export interface AgentCockpitTraceEvent {
  sequence: number;
  eventId: string;
  type: string;
  actor: string;
  at: string;
  message: string;
}

export interface AgentCockpitRunResponse {
  workItem: WorkItem;
  run: {
    id: string;
    status: AgentRunStatus;
  };
  steps: Array<{
    agent: string;
    status: AgentStepStatus;
    summary: string;
    toolName?: string;
  }>;
  trace: AgentCockpitTraceEvent[];
  questionnaireApproval: {
    status: ApprovalStatus;
    toolName: string;
  };
  submitApproval: {
    status: ApprovalStatus;
    toolName: string;
  };
  questionnairePackage: QuestionnairePackage;
  evidence: EvidenceListResponse;
  evidenceBoard: Array<{
    requirementCode: string;
    requirementLabel: string;
    requirementDetail: string;
    sourceLabel: string;
    status: string;
    fixtureIds: string[];
    evidenceAttachmentIds: string[];
  }>;
  packet: SubmissionPacket;
  statusTimeline: StatusEvent[];
  auditTrace: AuditEvent[];
}
