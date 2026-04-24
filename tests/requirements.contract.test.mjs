import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateRequirement } from "../apps/api/dist/evaluation/evaluate.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

test("golden MRI lumbar spine scenario returns the canonical requirements result", () => {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const result = evaluateRequirement(goldenScenario.request, repository);

  assert.equal(result.evaluationStatus, goldenScenario.expected.evaluationStatus);
  assert.equal(result.evaluationId, goldenScenario.expected.evaluationId);
  assert.equal(result.requiresPriorAuth, goldenScenario.expected.requiresPriorAuth);
  assert.equal(result.requiresDocs, goldenScenario.expected.requiresDocs);
  assert.equal(result.matchedRuleId, goldenScenario.expected.matchedRuleId);
  assert.equal(result.rulePackVersion, goldenScenario.expected.rulePackVersion);
  assert.equal(result.nextAction, goldenScenario.expected.nextAction);
  assert.equal(result.missingData.length, goldenScenario.expected.missingDataCount);
});

test("requirement evaluation registers an evaluation but does not create a work item", () => {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const result = evaluateRequirement(goldenScenario.request, repository);

  store.saveEvaluation(goldenScenario.request, result);

  assert.equal(store.hasWorkItems(), false);
});

test("work-item creation references the stored evaluated result without recomputing", () => {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const result = store.saveEvaluation(
    goldenScenario.request,
    evaluateRequirement(goldenScenario.request, repository)
  );

  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "contract-test"
  });

  assert.equal(workItem.evaluationId, result.evaluationId);
  assert.equal(workItem.requirementResult, result);
  assert.equal(workItem.status, "requirements_found");
});

test("unsupported service lines are explicit and do not match the MRI rule", () => {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const result = evaluateRequirement(
    {
      ...goldenScenario.request,
      serviceLine: "home_oxygen"
    },
    repository
  );

  assert.equal(result.evaluationStatus, "unsupported_service_line");
  assert.equal(result.matchedRuleId, null);
  assert.equal(result.nextAction, "select_supported_service_line");
});

test("missing supporting clinical evidence returns needs_baseline_data", () => {
  const repository = new FixtureFhirRepository("data/seed/mri_lumbar_spine_missing_evidence/fhir-bundle.json");
  const result = evaluateRequirement(goldenScenario.request, repository);

  assert.equal(result.evaluationStatus, "needs_baseline_data");
  assert.deepEqual(
    result.missingData.map((item) => item.code),
    ["conservative-treatment-evidence"]
  );
  assert.equal(result.nextAction, "collect_baseline_data");
});
