import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  AgentRun,
  AgentTask,
  ApprovalDecision,
  ApprovalRequest,
  DoctorRuntimeStore,
  TaskPlan,
  ToolCallRecord,
  TraceEvent
} from "./types.js";

type Row = Record<string, unknown>;

const SCHEMA_VERSION = 1;

export class SqliteRuntimeStore implements DoctorRuntimeStore {
  private readonly db: DatabaseSync;
  private transactionDepth = 0;

  constructor(
    private readonly databasePath = ":memory:",
    private readonly clock: () => Date = () => new Date()
  ) {
    if (databasePath !== ":memory:") {
      mkdirSync(dirname(databasePath), { recursive: true });
    }
    this.db = new DatabaseSync(databasePath, {
      allowBareNamedParameters: true,
      enableForeignKeyConstraints: true,
      readBigInts: false,
      returnArrays: false,
      timeout: 5000
    });
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.migrate();
  }

  nowIso(): string {
    return this.clock().toISOString();
  }

  close(): void {
    this.db.close();
  }

  transaction<T>(operation: () => T): T {
    if (this.transactionDepth > 0) {
      return operation();
    }
    this.db.exec("BEGIN IMMEDIATE;");
    this.transactionDepth = 1;
    try {
      const result = operation();
      this.db.exec("COMMIT;");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK;");
      throw error;
    } finally {
      this.transactionDepth = 0;
    }
  }

  createRun(input: { id?: string; objective: string; metadata?: Record<string, unknown> }): AgentRun {
    const now = this.nowIso();
    const run: AgentRun = {
      id: input.id ?? this.nextPrefixedId("agent_runs", "id", "run"),
      status: "running",
      objective: input.objective,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata ?? {}
    };
    return this.saveRun(run);
  }

  getRun(id: string): AgentRun | null {
    return runFromRow(this.db.prepare("SELECT * FROM agent_runs WHERE id = ?").get(id) as Row | undefined);
  }

  saveRun(run: AgentRun): AgentRun {
    this.db.prepare(`
      INSERT INTO agent_runs (id, status, objective, created_at, updated_at, completed_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        objective = excluded.objective,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at,
        metadata_json = excluded.metadata_json
    `).run(
      run.id,
      run.status,
      run.objective,
      run.createdAt,
      run.updatedAt,
      run.completedAt ?? null,
      encode(run.metadata)
    );
    return run;
  }

  createTask(input: { id?: string; runId: string; plan: TaskPlan }): AgentTask {
    const now = this.nowIso();
    const task: AgentTask = {
      id: input.id ?? this.nextPrefixedId("agent_tasks", "id", "task"),
      runId: input.runId,
      status: "running",
      plan: input.plan,
      createdAt: now,
      updatedAt: now
    };
    return this.saveTask(task);
  }

  getTask(id: string): AgentTask | null {
    return taskFromRow(this.db.prepare("SELECT * FROM agent_tasks WHERE id = ?").get(id) as Row | undefined);
  }

  saveTask(task: AgentTask): AgentTask {
    this.db.prepare(`
      INSERT INTO agent_tasks (id, run_id, status, plan_json, created_at, updated_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        plan_json = excluded.plan_json,
        updated_at = excluded.updated_at,
        completed_at = excluded.completed_at
    `).run(
      task.id,
      task.runId,
      task.status,
      encode(task.plan),
      task.createdAt,
      task.updatedAt,
      task.completedAt ?? null
    );
    return task;
  }

  saveToolCallRecord(record: ToolCallRecord): ToolCallRecord {
    this.db.prepare(`
      INSERT INTO tool_call_records (
        call_id, run_id, task_id, tool_name, category, risk_level, approval_required,
        approval_request_id, status, started_at, completed_at, input_json, output_json, error_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(call_id) DO UPDATE SET
        approval_request_id = excluded.approval_request_id,
        status = excluded.status,
        completed_at = excluded.completed_at,
        output_json = excluded.output_json,
        error_json = excluded.error_json
    `).run(
      record.callId,
      record.runId,
      record.taskId,
      record.toolName,
      record.category,
      record.riskLevel,
      record.approvalRequired ? 1 : 0,
      record.approvalRequestId ?? null,
      record.status,
      record.startedAt,
      record.completedAt ?? null,
      encode(record.input),
      record.output === undefined ? null : encode(record.output),
      record.error === undefined ? null : encode(record.error)
    );
    return record;
  }

  getToolCallRecord(callId: string): ToolCallRecord | null {
    return toolCallFromRow(
      this.db.prepare("SELECT * FROM tool_call_records WHERE call_id = ?").get(callId) as Row | undefined
    );
  }

  saveApprovalRequest(request: ApprovalRequest): ApprovalRequest {
    this.db.prepare(`
      INSERT INTO approval_requests (
        id, run_id, task_id, tool_call_id, tool_name, risk_level, status, reason,
        requested_by, requested_at, decided_by, decided_at, decision_reason, input_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        decided_by = excluded.decided_by,
        decided_at = excluded.decided_at,
        decision_reason = excluded.decision_reason
    `).run(
      request.id,
      request.runId,
      request.taskId,
      request.toolCallId,
      request.toolName,
      request.riskLevel,
      request.status,
      request.reason,
      request.requestedBy,
      request.requestedAt,
      request.decision?.decidedBy ?? null,
      request.decision?.decidedAt ?? null,
      request.decision?.reason ?? null,
      encode(request.input)
    );
    return request;
  }

  getApprovalRequest(id: string): ApprovalRequest | null {
    return approvalFromRow(this.db.prepare("SELECT * FROM approval_requests WHERE id = ?").get(id) as Row | undefined);
  }

  recordTraceEvent(input: Omit<TraceEvent, "sequence" | "eventId" | "at"> & { at?: string }): TraceEvent {
    const sequence = this.nextSequence();
    const event: TraceEvent = {
      sequence,
      eventId: `trace-${String(sequence).padStart(6, "0")}`,
      at: input.at ?? this.nowIso(),
      ...input
    };
    this.db.prepare(`
      INSERT INTO agent_trace_events (
        sequence, event_id, run_id, task_id, tool_call_id, approval_request_id,
        type, actor, at, message, data_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.sequence,
      event.eventId,
      event.runId,
      event.taskId ?? null,
      event.toolCallId ?? null,
      event.approvalRequestId ?? null,
      event.type,
      event.actor,
      event.at,
      event.message,
      encode(event.data)
    );
    return event;
  }

  listTraceEvents(runId: string): TraceEvent[] {
    return (this.db.prepare(`
      SELECT * FROM agent_trace_events WHERE run_id = ? ORDER BY sequence
    `).all(runId) as Row[]).map(traceFromRow);
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS doctor_runtime_schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL CHECK (length(applied_at) > 0)
      ) STRICT;
    `);
    const current = this.db.prepare(`
      SELECT COALESCE(MAX(version), 0) AS version FROM doctor_runtime_schema_migrations
    `).get() as Row;
    if (number(current.version) >= SCHEMA_VERSION) {
      return;
    }
    this.transaction(() => {
      this.db.exec(SCHEMA_SQL);
      this.db.prepare("INSERT INTO doctor_runtime_schema_migrations (version, applied_at) VALUES (?, ?)")
        .run(SCHEMA_VERSION, this.nowIso());
    });
  }

  private nextSequence(): number {
    const row = this.db.prepare("SELECT COALESCE(MAX(sequence), 0) + 1 AS next FROM agent_trace_events").get() as Row;
    return number(row.next);
  }

  private nextPrefixedId(table: string, column: string, prefix: string): string {
    const row = this.db.prepare(`
      SELECT COALESCE(MAX(CAST(substr(${column}, length(?) + 2) AS INTEGER)), 0) + 1 AS next
      FROM ${table}
      WHERE ${column} LIKE ? || '-%'
    `).get(prefix, prefix) as Row;
    return `${prefix}-${String(number(row.next)).padStart(6, "0")}`;
  }
}

function runFromRow(row: Row | undefined): AgentRun | null {
  if (!row) {
    return null;
  }
  return {
    id: text(row.id),
    status: text(row.status) as AgentRun["status"],
    objective: text(row.objective),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    completedAt: nullableText(row.completed_at) ?? undefined,
    metadata: decode(row.metadata_json)
  };
}

function taskFromRow(row: Row | undefined): AgentTask | null {
  if (!row) {
    return null;
  }
  return {
    id: text(row.id),
    runId: text(row.run_id),
    status: text(row.status) as AgentTask["status"],
    plan: decode(row.plan_json),
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    completedAt: nullableText(row.completed_at) ?? undefined
  };
}

function toolCallFromRow(row: Row | undefined): ToolCallRecord | null {
  if (!row) {
    return null;
  }
  return {
    callId: text(row.call_id),
    runId: text(row.run_id),
    taskId: text(row.task_id),
    toolName: text(row.tool_name) as ToolCallRecord["toolName"],
    category: text(row.category),
    riskLevel: text(row.risk_level) as ToolCallRecord["riskLevel"],
    approvalRequired: Boolean(row.approval_required),
    approvalRequestId: nullableText(row.approval_request_id) ?? undefined,
    status: text(row.status) as ToolCallRecord["status"],
    startedAt: text(row.started_at),
    completedAt: nullableText(row.completed_at) ?? undefined,
    input: decode(row.input_json),
    output: row.output_json === null ? undefined : decode(row.output_json),
    error: row.error_json === null ? undefined : decode(row.error_json)
  };
}

function approvalFromRow(row: Row | undefined): ApprovalRequest | null {
  if (!row) {
    return null;
  }
  const decidedBy = nullableText(row.decided_by);
  const decidedAt = nullableText(row.decided_at);
  const status = text(row.status) as ApprovalRequest["status"];
  const decision: ApprovalDecision | undefined = decidedBy && decidedAt
    ? {
        approvalRequestId: text(row.id),
        decision: status === "approved" ? "approved" : "rejected",
        decidedBy,
        decidedAt,
        reason: nullableText(row.decision_reason) ?? undefined
      }
    : undefined;

  return {
    id: text(row.id),
    runId: text(row.run_id),
    taskId: text(row.task_id),
    toolCallId: text(row.tool_call_id),
    toolName: text(row.tool_name) as ApprovalRequest["toolName"],
    riskLevel: text(row.risk_level) as ApprovalRequest["riskLevel"],
    status,
    reason: text(row.reason),
    requestedBy: text(row.requested_by),
    requestedAt: text(row.requested_at),
    decision,
    input: decode(row.input_json)
  };
}

function traceFromRow(row: Row): TraceEvent {
  return {
    sequence: number(row.sequence),
    eventId: text(row.event_id),
    runId: text(row.run_id),
    taskId: nullableText(row.task_id) ?? undefined,
    toolCallId: nullableText(row.tool_call_id) ?? undefined,
    approvalRequestId: nullableText(row.approval_request_id) ?? undefined,
    type: text(row.type),
    actor: text(row.actor),
    at: text(row.at),
    message: text(row.message),
    data: decode(row.data_json)
  };
}

function encode(value: unknown): string {
  return JSON.stringify(value);
}

function decode<T = any>(value: unknown): T {
  return JSON.parse(text(value)) as T;
}

function text(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error(`Expected SQLite text value, received ${typeof value}`);
  }
  return value;
}

function nullableText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function number(value: unknown): number {
  if (typeof value !== "number") {
    throw new Error(`Expected SQLite number value, received ${typeof value}`);
  }
  return value;
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS agent_runs (
  id TEXT PRIMARY KEY NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running','waiting_for_human','completed','rejected','failed')),
  objective TEXT NOT NULL CHECK (length(objective) > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  metadata_json TEXT NOT NULL CHECK (json_valid(metadata_json))
) STRICT;

CREATE TABLE IF NOT EXISTS agent_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending','running','waiting_for_human','completed','rejected','failed')),
  plan_json TEXT NOT NULL CHECK (json_valid(plan_json)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
) STRICT;

CREATE TABLE IF NOT EXISTS tool_call_records (
  call_id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  category TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  approval_required INTEGER NOT NULL CHECK (approval_required IN (0, 1)),
  approval_request_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed','blocked','waiting_for_approval','rejected')),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  input_json TEXT NOT NULL CHECK (json_valid(input_json)),
  output_json TEXT CHECK (output_json IS NULL OR json_valid(output_json)),
  error_json TEXT CHECK (error_json IS NULL OR json_valid(error_json))
) STRICT;

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY NOT NULL,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  tool_call_id TEXT NOT NULL REFERENCES tool_call_records(call_id) ON DELETE CASCADE,
  tool_name TEXT NOT NULL,
  risk_level TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected')),
  reason TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  requested_at TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT,
  decision_reason TEXT,
  input_json TEXT NOT NULL CHECK (json_valid(input_json))
) STRICT;

CREATE TABLE IF NOT EXISTS agent_trace_events (
  sequence INTEGER PRIMARY KEY NOT NULL CHECK (sequence > 0),
  event_id TEXT NOT NULL UNIQUE,
  run_id TEXT NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES agent_tasks(id) ON DELETE SET NULL,
  tool_call_id TEXT REFERENCES tool_call_records(call_id) ON DELETE SET NULL,
  approval_request_id TEXT REFERENCES approval_requests(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  actor TEXT NOT NULL,
  at TEXT NOT NULL,
  message TEXT NOT NULL,
  data_json TEXT NOT NULL CHECK (json_valid(data_json))
) STRICT;

CREATE INDEX IF NOT EXISTS idx_agent_tasks_run ON agent_tasks(run_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_call_records_run ON tool_call_records(run_id, started_at);
CREATE INDEX IF NOT EXISTS idx_approval_requests_run ON approval_requests(run_id, requested_at);
CREATE INDEX IF NOT EXISTS idx_agent_trace_events_run ON agent_trace_events(run_id, sequence);
`;
