import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  executeRuntimeTool,
  type RuntimeToolExecutionResult,
  type TraceEvent
} from "@open-prior-auth/doctor-runtime";
import {
  runDeterministicPriorAuthAgentTeam,
  type DeterministicPriorAuthAgentTeamResult
} from "@open-prior-auth/prior-auth-agent-team";
import type { RequirementEvaluationResult } from "@open-prior-auth/shared-types";
import { createHarness, promptInjectionText, repoPath } from "./harness.js";
import { assertNoInternalHttpBoundaries, assertPromptInjectionTreatedAsData, assertSafetyClaims, assertToolPolicy, type EvalAssertion } from "./policy.js";
import { scenarioRegistry, type DoctorEvalScenario } from "./scenarios.js";
import { compareGoldenTrace, normalizeTrace, type GoldenTraceDiff, type NormalizedTraceEvent } from "./trace.js";

export interface DoctorEvalRunOptions {
  scenarioIds?: readonly string[];
  reportDirectory?: string;
  writeReports?: boolean;
}

export interface DoctorEvalScenarioReport {
  scenarioId: string;
  status: "passed" | "failed";
  description: string;
  evaluationStatus: string;
  assertions: EvalAssertion[];
  traceDiffs: GoldenTraceDiff[];
  normalizedTrace: NormalizedTraceEvent[];
}

export interface DoctorEvalReport {
  reportVersion: "m8.formal-doctor-evals.v1";
  generatedAt: string;
  status: "passed" | "failed";
  totals: {
    scenarios: number;
    passed: number;
    failed: number;
    assertions: number;
    failedAssertions: number;
  };
  scenarios: DoctorEvalScenarioReport[];
}

interface ScenarioExecution {
  trace: TraceEvent[];
  evaluationStatus: string;
  result: unknown;
}

export async function runDoctorEvals(options: DoctorEvalRunOptions = {}): Promise<DoctorEvalReport> {
  const selected = scenarioRegistry.filter((scenario) =>
    !options.scenarioIds || options.scenarioIds.includes(scenario.id)
  );
  const scenarioReports: DoctorEvalScenarioReport[] = [];

  for (const scenario of selected) {
    scenarioReports.push(await runScenario(scenario));
  }

  const failed = scenarioReports.filter((scenario) => scenario.status === "failed").length;
  const failedAssertions = scenarioReports.flatMap((scenario) => scenario.assertions).filter((assertion) => assertion.status === "failed").length;
  const report: DoctorEvalReport = {
    reportVersion: "m8.formal-doctor-evals.v1",
    generatedAt: "2026-04-25T12:00:00.000Z",
    status: failed === 0 && failedAssertions === 0 ? "passed" : "failed",
    totals: {
      scenarios: scenarioReports.length,
      passed: scenarioReports.length - failed,
      failed,
      assertions: scenarioReports.reduce((total, scenario) => total + scenario.assertions.length, 0),
      failedAssertions
    },
    scenarios: scenarioReports
  };

  if (options.writeReports ?? true) {
    writeReport(report, options.reportDirectory ?? repoPath("packages/doctor-evals/reports"));
  }

  return report;
}

async function runScenario(scenario: DoctorEvalScenario): Promise<DoctorEvalScenarioReport> {
  const execution = await executeScenario(scenario);
  const normalizedTrace = normalizeTrace(execution.trace);
  const expectedTrace = readGoldenTrace(scenario.id);
  const traceDiffs = compareGoldenTrace(expectedTrace, normalizedTrace);
  const assertions = [
    ...assertEvaluationStatus(scenario, execution.evaluationStatus),
    ...assertToolPolicy(scenario, normalizedTrace, execution.result),
    ...assertSafetyClaims({
      scenarioId: scenario.id,
      evaluationStatus: execution.evaluationStatus,
      result: execution.result
    }, [promptInjectionText]),
    ...assertNoInternalHttpBoundaries()
  ];

  if (scenario.promptInjectionEvidence) {
    assertions.push(...assertPromptInjectionTreatedAsData(execution.result as DeterministicPriorAuthAgentTeamResult));
  }

  if (traceDiffs.length === 0) {
    assertions.push({ name: "trace.golden_match", status: "passed", message: "Normalized trace matches golden file." });
  } else {
    assertions.push({ name: "trace.golden_match", status: "failed", message: `${traceDiffs.length} normalized trace diff(s).` });
  }

  const failedAssertions = assertions.some((assertion) => assertion.status === "failed");
  return {
    scenarioId: scenario.id,
    status: failedAssertions || traceDiffs.length > 0 ? "failed" : "passed",
    description: scenario.description,
    evaluationStatus: execution.evaluationStatus,
    assertions,
    traceDiffs,
    normalizedTrace
  };
}

async function executeScenario(scenario: DoctorEvalScenario): Promise<ScenarioExecution> {
  const harness = createHarness(scenario);
  try {
    if (scenario.kind === "agent_team") {
      if (!harness.workItem) {
        throw new Error(`Scenario ${scenario.id} did not create a work item.`);
      }
      const result = await runDeterministicPriorAuthAgentTeam({
        workItemId: harness.workItem.id,
        actorUserId: scenario.actorUserId,
        questionnaireApprovalActorUserId: scenario.approverUserId
      }, harness.runtimeDependencies);
      return {
        trace: result.trace,
        evaluationStatus: result.requirementEvaluation.evaluationStatus,
        result
      };
    }

    const result = await executeRuntimeTool({
      toolName: "doctor.requirements.evaluate",
      input: { request: scenario.request },
      callContext: { actorUserId: scenario.actorUserId }
    }, harness.runtimeDependencies) as RuntimeToolExecutionResult;

    if (!result.ok) {
      throw new Error(`Requirement-only scenario failed: ${result.error.message}`);
    }

    const output = result.output as RequirementEvaluationResult;
    return {
      trace: harness.runtimeStore.listTraceEvents(result.run.id),
      evaluationStatus: output.evaluationStatus,
      result
    };
  } finally {
    harness.runtimeStore.close();
  }
}

function readGoldenTrace(scenarioId: string): NormalizedTraceEvent[] {
  return JSON.parse(
    readFileSync(repoPath(`packages/doctor-evals/golden/${scenarioId}.trace.json`), "utf8")
  ) as NormalizedTraceEvent[];
}

function assertEvaluationStatus(scenario: DoctorEvalScenario, actual: string): EvalAssertion[] {
  return [{
    name: "scenario.expected_evaluation_status",
    status: actual === scenario.expectedEvaluationStatus ? "passed" : "failed",
    message: `Expected ${scenario.expectedEvaluationStatus}, got ${actual}.`
  }];
}

function writeReport(report: DoctorEvalReport, directory: string): void {
  mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "latest.json"), `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(resolve(directory, "latest.md"), markdownReport(report));
}

function markdownReport(report: DoctorEvalReport): string {
  const lines = [
    "# M8 Formal Doctor Evals Report",
    "",
    `Status: ${report.status}`,
    `Generated at: ${report.generatedAt}`,
    `Scenarios: ${report.totals.passed}/${report.totals.scenarios} passed`,
    `Assertions: ${report.totals.assertions - report.totals.failedAssertions}/${report.totals.assertions} passed`,
    "",
    "| Scenario | Status | Evaluation | Assertions | Trace diffs |",
    "| --- | --- | --- | ---: | ---: |"
  ];

  for (const scenario of report.scenarios) {
    const passedAssertions = scenario.assertions.filter((assertion) => assertion.status === "passed").length;
    lines.push(`| ${scenario.scenarioId} | ${scenario.status} | ${scenario.evaluationStatus} | ${passedAssertions}/${scenario.assertions.length} | ${scenario.traceDiffs.length} |`);
  }

  lines.push("");
  lines.push("## Failed Assertions");
  const failures = report.scenarios.flatMap((scenario) =>
    scenario.assertions
      .filter((assertion) => assertion.status === "failed")
      .map((assertion) => `- ${scenario.scenarioId}: ${assertion.name} - ${assertion.message}`)
  );
  lines.push(...(failures.length > 0 ? failures : ["- None"]));
  lines.push("");
  return `${lines.join("\n")}\n`;
}
