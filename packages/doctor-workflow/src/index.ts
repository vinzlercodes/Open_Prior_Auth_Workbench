export type WorkflowRunStatus = "created" | "running" | "waiting_for_signal" | "completed" | "failed" | "cancelled";

export interface WorkflowRun {
  id: string;
  caseId: string;
  agentRunId: string;
  workflowType: string;
  status: WorkflowRunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowCheckpoint {
  id: string;
  runId: string;
  name: string;
  state: unknown;
  createdAt: string;
}

export interface WorkflowSignal {
  id: string;
  runId: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

export interface HumanTask {
  id: string;
  runId: string;
  approvalRequestId?: string;
  status: "open" | "resolved" | "cancelled";
  createdAt: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
}

export interface IdempotencyKey {
  runId: string;
  key: string;
  reservedAt: string;
}

export interface WorkflowStore {
  nowIso(): string;
  saveRun(run: WorkflowRun): WorkflowRun;
  getRun(id: string): WorkflowRun | null;
  listPendingRuns(): WorkflowRun[];
  saveCheckpoint(checkpoint: WorkflowCheckpoint): WorkflowCheckpoint;
  listCheckpoints(runId: string): WorkflowCheckpoint[];
  saveSignal(signal: WorkflowSignal): WorkflowSignal;
  listSignals(runId: string): WorkflowSignal[];
  reserveIdempotencyKey(input: IdempotencyKey): boolean;
}

export class InMemoryWorkflowStore implements WorkflowStore {
  private readonly runs = new Map<string, WorkflowRun>();
  private readonly checkpoints: WorkflowCheckpoint[] = [];
  private readonly signals: WorkflowSignal[] = [];
  private readonly idempotencyKeys = new Set<string>();

  constructor(private readonly clock: () => string = () => new Date().toISOString()) {}

  nowIso(): string {
    return this.clock();
  }

  saveRun(run: WorkflowRun): WorkflowRun {
    this.runs.set(run.id, snapshot(run));
    return snapshot(run);
  }

  getRun(id: string): WorkflowRun | null {
    const run = this.runs.get(id);
    return run ? snapshot(run) : null;
  }

  listPendingRuns(): WorkflowRun[] {
    return [...this.runs.values()]
      .filter((run) => run.status === "created" || run.status === "running" || run.status === "waiting_for_signal")
      .map((run) => snapshot(run));
  }

  saveCheckpoint(checkpoint: WorkflowCheckpoint): WorkflowCheckpoint {
    this.checkpoints.push(snapshot(checkpoint));
    return snapshot(checkpoint);
  }

  listCheckpoints(runId: string): WorkflowCheckpoint[] {
    return this.checkpoints.filter((checkpoint) => checkpoint.runId === runId).map((checkpoint) => snapshot(checkpoint));
  }

  saveSignal(signal: WorkflowSignal): WorkflowSignal {
    this.signals.push(snapshot(signal));
    return snapshot(signal);
  }

  listSignals(runId: string): WorkflowSignal[] {
    return this.signals.filter((signal) => signal.runId === runId).map((signal) => snapshot(signal));
  }

  reserveIdempotencyKey(input: IdempotencyKey): boolean {
    const compound = `${input.runId}:${input.key}`;
    if (this.idempotencyKeys.has(compound)) {
      return false;
    }
    this.idempotencyKeys.add(compound);
    return true;
  }
}

export class SqliteWorkflowStore implements WorkflowStore {
  private readonly database: DatabaseSync;

  constructor(
    databasePath = ":memory:",
    private readonly clock: () => string = () => new Date().toISOString()
  ) {
    this.database = new DatabaseSync(databasePath);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS workflow_runs (
        id TEXT PRIMARY KEY,
        case_id TEXT NOT NULL,
        agent_run_id TEXT NOT NULL,
        workflow_type TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workflow_checkpoints (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        name TEXT NOT NULL,
        state_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workflow_signals (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS workflow_idempotency_keys (
        run_id TEXT NOT NULL,
        key TEXT NOT NULL,
        reserved_at TEXT NOT NULL,
        PRIMARY KEY (run_id, key)
      );
    `);
  }

  nowIso(): string {
    return this.clock();
  }

  saveRun(run: WorkflowRun): WorkflowRun {
    this.database.prepare(`
      INSERT INTO workflow_runs (id, case_id, agent_run_id, workflow_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        case_id = excluded.case_id,
        agent_run_id = excluded.agent_run_id,
        workflow_type = excluded.workflow_type,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(run.id, run.caseId, run.agentRunId, run.workflowType, run.status, run.createdAt, run.updatedAt);
    return snapshot(run);
  }

  getRun(id: string): WorkflowRun | null {
    const row = this.database.prepare("SELECT * FROM workflow_runs WHERE id = ?").get(id) as WorkflowRunRow | undefined;
    return row ? runFromRow(row) : null;
  }

  listPendingRuns(): WorkflowRun[] {
    return this.database.prepare(`
      SELECT * FROM workflow_runs
      WHERE status IN ('created', 'running', 'waiting_for_signal')
      ORDER BY created_at, id
    `).all().map((row) => runFromRow(row as unknown as WorkflowRunRow));
  }

  saveCheckpoint(checkpoint: WorkflowCheckpoint): WorkflowCheckpoint {
    this.database.prepare(`
      INSERT OR REPLACE INTO workflow_checkpoints (id, run_id, name, state_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(checkpoint.id, checkpoint.runId, checkpoint.name, JSON.stringify(checkpoint.state), checkpoint.createdAt);
    return snapshot(checkpoint);
  }

  listCheckpoints(runId: string): WorkflowCheckpoint[] {
    return this.database.prepare(`
      SELECT * FROM workflow_checkpoints WHERE run_id = ? ORDER BY created_at, id
    `).all(runId).map((row) => checkpointFromRow(row as unknown as WorkflowCheckpointRow));
  }

  saveSignal(signal: WorkflowSignal): WorkflowSignal {
    this.database.prepare(`
      INSERT OR REPLACE INTO workflow_signals (id, run_id, type, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(signal.id, signal.runId, signal.type, JSON.stringify(signal.payload), signal.createdAt);
    return snapshot(signal);
  }

  listSignals(runId: string): WorkflowSignal[] {
    return this.database.prepare(`
      SELECT * FROM workflow_signals WHERE run_id = ? ORDER BY created_at, id
    `).all(runId).map((row) => signalFromRow(row as unknown as WorkflowSignalRow));
  }

  reserveIdempotencyKey(input: IdempotencyKey): boolean {
    try {
      this.database.prepare(`
        INSERT INTO workflow_idempotency_keys (run_id, key, reserved_at)
        VALUES (?, ?, ?)
      `).run(input.runId, input.key, input.reservedAt);
      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE")) {
        return false;
      }
      throw error;
    }
  }

  close(): void {
    this.database.close();
  }
}

interface WorkflowRunRow {
  id: string;
  case_id: string;
  agent_run_id: string;
  workflow_type: string;
  status: WorkflowRunStatus;
  created_at: string;
  updated_at: string;
}

interface WorkflowCheckpointRow {
  id: string;
  run_id: string;
  name: string;
  state_json: string;
  created_at: string;
}

interface WorkflowSignalRow {
  id: string;
  run_id: string;
  type: string;
  payload_json: string;
  created_at: string;
}

function runFromRow(row: WorkflowRunRow): WorkflowRun {
  return {
    id: row.id,
    caseId: row.case_id,
    agentRunId: row.agent_run_id,
    workflowType: row.workflow_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function checkpointFromRow(row: WorkflowCheckpointRow): WorkflowCheckpoint {
  return {
    id: row.id,
    runId: row.run_id,
    name: row.name,
    state: JSON.parse(row.state_json) as unknown,
    createdAt: row.created_at
  };
}

function signalFromRow(row: WorkflowSignalRow): WorkflowSignal {
  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
    payload: JSON.parse(row.payload_json) as unknown,
    createdAt: row.created_at
  };
}

export function createWorkflowRun(
  store: WorkflowStore,
  input: { id: string; caseId: string; agentRunId: string; workflowType: string }
): WorkflowRun {
  const now = store.nowIso();
  return store.saveRun({
    id: input.id,
    caseId: input.caseId,
    agentRunId: input.agentRunId,
    workflowType: input.workflowType,
    status: "created",
    createdAt: now,
    updatedAt: now
  });
}

export function recordWorkflowCheckpoint(
  store: WorkflowStore,
  input: { runId: string; name: string; state: unknown }
): WorkflowCheckpoint {
  return store.saveCheckpoint({
    id: `wfc-${store.listCheckpoints(input.runId).length + 1}`,
    runId: input.runId,
    name: input.name,
    state: input.state,
    createdAt: store.nowIso()
  });
}

export function signalWorkflow(
  store: WorkflowStore,
  input: { runId: string; type: string; payload: unknown }
): WorkflowSignal {
  return store.saveSignal({
    id: `wfs-${store.listSignals(input.runId).length + 1}`,
    runId: input.runId,
    type: input.type,
    payload: input.payload,
    createdAt: store.nowIso()
  });
}

export function reserveIdempotencyKey(
  store: WorkflowStore,
  input: { runId: string; key: string }
): { reserved: boolean } {
  return {
    reserved: store.reserveIdempotencyKey({
      runId: input.runId,
      key: input.key,
      reservedAt: store.nowIso()
    })
  };
}

export function resumeRun(store: WorkflowStore, runId: string): {
  run: WorkflowRun;
  nextCheckpoint: WorkflowCheckpoint | null;
  signals: WorkflowSignal[];
} | null {
  const run = store.getRun(runId);
  if (!run) {
    return null;
  }
  const checkpoints = store.listCheckpoints(runId);
  return {
    run,
    nextCheckpoint: checkpoints.at(-1) ?? null,
    signals: store.listSignals(runId)
  };
}

function snapshot<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
import { DatabaseSync } from "node:sqlite";
