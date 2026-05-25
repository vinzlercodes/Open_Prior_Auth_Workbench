import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  assertNoInternalHttpBoundaries,
  assertSafetyClaims,
  compareGoldenTrace,
  runDoctorEvals,
  scenarioRegistry
} from "../packages/doctor-evals/dist/index.js";

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : [];
  });
}

test("M8 package exports scenario registry and eval runner", () => {
  assert.equal(typeof runDoctorEvals, "function");
  assert.equal(typeof compareGoldenTrace, "function");
  assert.deepEqual(scenarioRegistry.map((scenario) => scenario.id), [
    "mri_happy_path",
    "dme_power_wheelchair_happy_path",
    "mri_missing_evidence",
    "mri_prompt_injection_evidence"
  ]);
});

test("golden trace diff detects missing, extra, and reordered events", () => {
  const expected = [
    { type: "run.started" },
    { type: "tool_call.started", toolName: "doctor.case.get" }
  ];
  assert.equal(compareGoldenTrace(expected, expected).length, 0);

  const diffs = compareGoldenTrace(expected, [
    { type: "tool_call.started", toolName: "doctor.case.get" },
    { type: "run.started" },
    { type: "tool_call.succeeded", toolName: "doctor.case.get" }
  ]);
  assert.equal(diffs.length, 3);
  assert.equal(diffs[0].message, "Trace event 0 changed.");
  assert.equal(diffs[2].message, "Trace event 2 unexpected.");
});

test("M8 eval runner emits passing JSON and markdown reports", async () => {
  const directory = mkdtempSync(join(tmpdir(), "doctor-evals-"));
  try {
    const report = await runDoctorEvals({ reportDirectory: directory });
    assert.equal(report.status, "passed");
    assert.equal(report.totals.scenarios, 4);
    assert.equal(report.totals.failed, 0);
    assert.equal(report.totals.failedAssertions, 0);

    const json = JSON.parse(readFileSync(join(directory, "latest.json"), "utf8"));
    const markdown = readFileSync(join(directory, "latest.md"), "utf8");
    assert.equal(json.status, "passed");
    assert.match(markdown, /mri_prompt_injection_evidence/);
    assert.match(markdown, /Assertions:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("M8 evals enforce policy and safety assertions", async () => {
  const report = await runDoctorEvals({ writeReports: false });
  const assertions = report.scenarios.flatMap((scenario) => scenario.assertions);

  for (const name of [
    "tool_policy.questionnaire_write_approval_gate",
    "tool_policy.submit_stays_pending",
    "tool_policy.requirement_only_no_approval",
    "safety.prompt_injection_not_in_agent_control_plane",
    "trace.golden_match"
  ]) {
    assert.ok(assertions.some((assertion) => assertion.name === name && assertion.status === "passed"), `Missing passed assertion ${name}`);
  }

  const unsafe = assertSafetyClaims({ claim: "This system is PHI-ready for real payer submission." });
  assert.ok(unsafe.some((assertion) => assertion.status === "failed"));
});

test("M8 eval package does not import app adapters or internal HTTP boundaries", () => {
  const source = sourceFiles(resolve(process.cwd(), "packages/doctor-evals/src"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  for (const forbidden of ["apps/api", "../apps"]) {
    assert.ok(!source.includes(forbidden), `doctor-evals source must not include ${forbidden}`);
  }

  for (const assertion of assertNoInternalHttpBoundaries()) {
    assert.equal(assertion.status, "passed", assertion.message);
  }
});
