export type AgentRunStatus = "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
export type AgentTaskStatus = "pending" | "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
export type RuntimeExternalToolCallStatus = "succeeded" | "failed" | "blocked";
export type RuntimeToolCallStatus = RuntimeExternalToolCallStatus | "waiting_for_approval" | "rejected";
export type ApprovalRequestStatus = "pending" | "approved" | "rejected";
export type ApprovalDecisionValue = "approved" | "rejected";

export interface RuntimeToolApprovalMetadata {
  approvalRequired: boolean;
  reason?: string;
  blockedCode?: string;
}

export interface RuntimeToolDefinition {
  name: string;
  category: string;
  riskLevel: string;
  approval: RuntimeToolApprovalMetadata;
  executable: boolean;
}

export interface RuntimeToolError {
  code: string;
  message: string;
  details?: unknown;
}

export interface RuntimeToolCallContext {
  actorUserId?: string;
  agentRunId?: string;
  agentTaskId?: string;
}

export interface RuntimeExternalToolCallRecord {
  callId: string;
  toolName: string;
  category: string;
  riskLevel: string;
  approvalRequired: boolean;
  status: RuntimeExternalToolCallStatus;
  startedAt: string;
  completedAt: string;
  input: unknown;
  output?: unknown;
  error?: RuntimeToolError;
}

export type RuntimeExternalToolExecutionResult =
  | {
      ok: true;
      output: unknown;
      record: RuntimeExternalToolCallRecord;
    }
  | {
      ok: false;
      error: RuntimeToolError;
      record: RuntimeExternalToolCallRecord;
    };

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
  toolName: string;
  category: string;
  riskLevel: string;
  approvalRequired: boolean;
  approvalRequestId?: string;
  status: RuntimeToolCallStatus;
  startedAt: string;
  completedAt?: string;
  input: unknown;
  output?: unknown;
  error?: RuntimeToolError;
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
  toolName: string;
  riskLevel: string;
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

export interface RuntimeToolExecutionRequest {
  runId?: string;
  taskId?: string;
  taskPlan?: TaskPlan;
  objective?: string;
  toolName: string;
  input: unknown;
  callContext?: RuntimeToolCallContext;
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
      error: RuntimeToolError;
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
      error: RuntimeToolError;
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
  toolCatalog: RuntimeToolCatalog;
  clock?: RuntimeClock;
  idGenerator?: RuntimeIdGenerator;
}

export interface RuntimeToolCatalog {
  getToolDefinition(toolName: string): RuntimeToolDefinition;
  executeTool(request: RuntimeToolExecutionRequest): Promise<RuntimeExternalToolExecutionResult>;
  executeApprovedTool(approvalRequest: ApprovalRequest): Promise<unknown> | unknown;
}

export interface DoctorRuntime {
  executeRuntimeTool(request: RuntimeToolExecutionRequest): Promise<RuntimeToolExecutionResult>;
  approveApprovalRequest(request: ApprovalDecisionRequest): Promise<ApprovalDecisionResult>;
  rejectApprovalRequest(request: ApprovalDecisionRequest): Promise<ApprovalDecisionResult>;
}
