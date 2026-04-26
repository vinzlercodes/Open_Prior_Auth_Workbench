import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createLocalStandardsAdapters } from "../apps/api/dist/adapters/localStandardsAdapters.js";
import { evaluateRequirement } from "../apps/api/dist/evaluation/evaluate.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

test("local standards adapters preserve existing local behavior and name non-conformance", () => {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const adapters = createLocalStandardsAdapters(repository, store);
  const direct = evaluateRequirement(goldenScenario.request, repository);
  const adapted = adapters.crd.evaluate(goldenScenario.request);

  assert.equal(adapters.launch.conformance, "local-launch-shim-not-smart");
  assert.equal(adapters.crd.conformance, "local-crd-inspired-not-cds-hooks");
  assert.equal(adapters.dtr.conformance, "local-dtr-inspired-not-questionnaire-package");
  assert.equal(adapters.pas.conformance, "local-pas-style-mock-not-da-vinci-pas");
  assert.equal(adapted.evaluationId, direct.evaluationId);
  assert.deepEqual(adapters.launch.getPatientContext("patient-mri-001").patient.id, "patient-mri-001");
  assert.equal(store.getRequirementRun(adapted.evaluationId).result.evaluationStatus, "requirements_found");
});
