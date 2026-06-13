import type { AgentRun, TaskPlan } from "./types.js";

export interface AgentSpec {
  name: string;
  role: string;
  instructions: string;
  allowedTools: string[];
  outputSchema: unknown;
  handoffTargets?: string[];
  escalationPolicy?: unknown;
}

export interface AgentRunner<StartInput = unknown, ResumeInput = unknown, StepResult = unknown> {
  startRun(input: StartInput): Promise<AgentRun>;
  resumeRun(input: ResumeInput): Promise<AgentRun>;
  stepRun(input: ResumeInput): Promise<StepResult>;
}

export interface Planner<Context = unknown> {
  createPlan(context: Context): Promise<TaskPlan> | TaskPlan;
  nextTask(run: AgentRun): Promise<TaskPlan | null> | TaskPlan | null;
}

export interface RunResumer<ResumeResult = unknown> {
  resume(runId: string): Promise<ResumeResult | null> | ResumeResult | null;
}

export interface HandoffRouter {
  nextAgent(spec: AgentSpec, reason: string): AgentSpec | null;
}

export interface OutputValidator {
  validate(output: unknown, schema: unknown): { ok: true } | { ok: false; error: string };
}

export interface ModelAdapter {
  complete(input: { instructions: string; prompt: string; schema?: unknown }): Promise<unknown>;
}

export function createAgentSpec(spec: AgentSpec): AgentSpec {
  return {
    ...spec,
    allowedTools: [...spec.allowedTools],
    handoffTargets: spec.handoffTargets ? [...spec.handoffTargets] : undefined
  };
}

export function createDeterministicPlanner(plan: TaskPlan): Planner {
  return {
    createPlan: () => plan,
    nextTask: (run: AgentRun) => run.status === "completed" ? null : plan
  };
}

export function createNoopHandoffRouter(): HandoffRouter {
  return {
    nextAgent: () => null
  };
}

export function createNoopOutputValidator(): OutputValidator {
  return {
    validate: () => ({ ok: true })
  };
}

export function createReplayRunResumer<T>(lookup: (runId: string) => T | null): RunResumer<T> {
  return {
    resume: (runId: string) => lookup(runId)
  };
}
