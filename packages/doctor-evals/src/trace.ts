import type { TraceEvent } from "@open-prior-auth/doctor-runtime";

export interface NormalizedTraceEvent {
  type: string;
  toolName?: string;
  agentRole?: string;
  riskLevel?: string;
  taskToolName?: string;
}

export interface GoldenTraceDiff {
  index: number;
  expected?: NormalizedTraceEvent;
  actual?: NormalizedTraceEvent;
  message: string;
}

export function normalizeTrace(trace: TraceEvent[]): NormalizedTraceEvent[] {
  return trace.map((event) => {
    const data = event.data as Record<string, unknown> | null;
    return prune({
      type: event.type,
      toolName: stringValue(data?.toolName),
      agentRole: stringValue(data?.agentRole),
      riskLevel: stringValue(data?.riskLevel),
      taskToolName: taskToolName(data)
    });
  });
}

export function compareGoldenTrace(
  expected: NormalizedTraceEvent[],
  actual: NormalizedTraceEvent[]
): GoldenTraceDiff[] {
  const length = Math.max(expected.length, actual.length);
  const diffs: GoldenTraceDiff[] = [];

  for (let index = 0; index < length; index += 1) {
    const expectedEvent = expected[index];
    const actualEvent = actual[index];
    if (JSON.stringify(expectedEvent) !== JSON.stringify(actualEvent)) {
      diffs.push({
        index,
        expected: expectedEvent,
        actual: actualEvent,
        message: expectedEvent && actualEvent
          ? `Trace event ${index} changed.`
          : `Trace event ${index} ${expectedEvent ? "missing" : "unexpected"}.`
      });
    }
  }

  return diffs;
}

function taskToolName(data: Record<string, unknown> | null): string | undefined {
  const plan = data?.plan as { steps?: unknown[] } | undefined;
  const firstStep = typeof plan?.steps?.[0] === "string" ? plan.steps[0] : undefined;
  return firstStep?.startsWith("Call ") ? firstStep.slice("Call ".length).replace(/\.$/, "") : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function prune(event: NormalizedTraceEvent): NormalizedTraceEvent {
  return Object.fromEntries(
    Object.entries(event).filter(([, value]) => value !== undefined)
  ) as NormalizedTraceEvent;
}
