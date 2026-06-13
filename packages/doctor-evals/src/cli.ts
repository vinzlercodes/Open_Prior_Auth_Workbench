import { runDoctorEvals } from "./runner.js";

const report = await runDoctorEvals();

process.stdout.write([
  `M8 Doctor Evals: ${report.status}`,
  `Scenarios: ${report.totals.passed}/${report.totals.scenarios} passed`,
  `Assertions: ${report.totals.assertions - report.totals.failedAssertions}/${report.totals.assertions} passed`
].join("\n") + "\n");

if (report.status !== "passed") {
  process.exitCode = 1;
}
