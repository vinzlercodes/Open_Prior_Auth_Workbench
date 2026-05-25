import { runDoctorEvals } from "./runner.js";

const report = await runDoctorEvals();

console.log(`M8 Doctor Evals: ${report.status}`);
console.log(`Scenarios: ${report.totals.passed}/${report.totals.scenarios} passed`);
console.log(`Assertions: ${report.totals.assertions - report.totals.failedAssertions}/${report.totals.assertions} passed`);

if (report.status !== "passed") {
  process.exitCode = 1;
}
