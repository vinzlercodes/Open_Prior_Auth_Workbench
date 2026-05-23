import type {
  DoctorToolCallContext,
  DoctorToolCallStatus,
  DoctorToolDependencies,
  DoctorToolError,
  DoctorToolInputByName,
  DoctorToolName,
  DoctorToolRiskLevel
} from "@open-prior-auth/doctor-toolnet";

export type AgentRunStatus = "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
export type AgentTaskStatus = "pending" | "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
export type RuntimeToolCallStatus = DoctorToolCallStatus | "waiting_for_approval" | "rejected";
export type ApprovalRequestStatus = "pending" | "approved" | "rejected";
export type ApprovalDecisionValue = "approved" | "rejected";

export interface AgentRun {
  id: string;
  status: AgentRunStatus;
  objective: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  metadata: Record<string, unknown>;
}

export interface TaskPlan {
  objective: string;
  steps: string[];
}

export interface AgentTask {
  id: string;
  runId: string;
  status: AgentTaskStatus;
  plan: TaskPlan;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface ToolCallRecord {
  callId: string;
  runId: string;
  taskId: string;
  toolName: DoctorToolName;
  category: string;
  riskLevel: DoctorToolRiskLevel;
  approvalRequired: boolean;
  approvalRequestId?: string;
  status: RuntimeToolCallStatus;
  startedAt: string;
  completedAt?: string;
  input: unknown;
  output?: unknown;
  error?: DoctorToolError;
}

export interface ApprovalDecision {
  approvalRequestId: string;
  decision: ApprovalDecisionValue;
  decidedBy: string;
  decidedAt: string;
  reason?: string;
}

export interface ApprovalRequest {
  id: string;
  runId: string;
  taskId: string;
  toolCallId: string;
  toolName: DoctorToolName;
  riskLevel: DoctorToolRiskLevel;
  status: ApprovalRequestStatus;
  reason: string;
  requestedBy: string;
  requestedAt: string;
  decision?: ApprovalDecision;
  input: unknown;
}

export interface TraceEvent {
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

export interface RuntimeClock {
  nowIso(): string;
}

export interface RuntimeIdGenerator {
  generateId(prefix?: string): string;
}

export interface RuntimeToolExecutionRequest<Name extends DoctorToolName = DoctorToolName> {
  runId?: string;
  taskId?: string;
  taskPlan?: TaskPlan;
  objective?: string;
  toolName: Name;
  input: DoctorToolInputByName[Name];
  callContext?: DoctorToolCallContext;
}

export type RuntimeToolExecutionResult =
  | {
      ok: true;
      run: AgentRun;
      task: AgentTask;
      record: ToolCallRecord;
      output: unknown;
    }
  | {
      ok: false;
      run: AgentRun;
      task: AgentTask;
      record: ToolCallRecord;
      error: DoctorToolError;
      approvalRequest?: ApprovalRequest;
    };

export interface ApprovalDecisionRequest {
  approvalRequestId: string;
  actorUserId?: string;
  reason?: string;
}

export type ApprovalDecisionResult =
  | {
      ok: true;
      run: AgentRun;
      task: AgentTask;
      record: ToolCallRecord;
      approvalRequest: ApprovalRequest;
      output?: unknown;
    }
  | {
      ok: false;
      run: AgentRun;
      task: AgentTask;
      record: ToolCallRecord;
      approvalRequest: ApprovalRequest;
      error: DoctorToolError;
    };

export interface DoctorRuntimeStore {
  nowIso(): string;
  transaction<T>(operation: () => T): T;
  close?(): void;
  createRun(input: { id?: string; objective: string; metadata?: Record<string, unknown> }): AgentRun;
  getRun(id: string): AgentRun | null;
  saveRun(run: AgentRun): AgentRun;
  createTask(input: { id?: string; runId: string; plan: TaskPlan }): AgentTask;
  getTask(id: string): AgentTask | null;
  saveTask(task: AgentTask): AgentTask;
  saveToolCallRecord(record: ToolCallRecord): ToolCallRecord;
  getToolCallRecord(callId: string): ToolCallRecord | null;
  saveApprovalRequest(request: ApprovalRequest): ApprovalRequest;
  getApprovalRequest(id: string): ApprovalRequest | null;
  recordTraceEvent(input: Omit<TraceEvent, "sequence" | "eventId" | "at"> & { at?: string }): TraceEvent;
  listTraceEvents(runId: string): TraceEvent[];
}

export interface DoctorRuntimeDependencies {
  runtimeStore: DoctorRuntimeStore;
  toolDependencies: DoctorToolDependencies;
  clock?: RuntimeClock;
  idGenerator?: RuntimeIdGenerator;
}

export interface DoctorRuntime {
  executeRuntimeTool<Name extends DoctorToolName>(
    request: RuntimeToolExecutionRequest<Name>
  ): Promise<RuntimeToolExecutionResult>;
  approveApprovalRequest(request: ApprovalDecisionRequest): Promise<ApprovalDecisionResult>;
  rejectApprovalRequest(request: ApprovalDecisionRequest): Promise<ApprovalDecisionResult>;
}
