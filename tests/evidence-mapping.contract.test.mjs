import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  evaluateRequirement,
  listEvidence,
  mapEvidenceToRequirements
} from "../packages/prior-auth-core/dist/index.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

test("core maps evidence fixtures to requirements with strength, rationale, and explicit missing rows", () => {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore(() => new Date("2026-04-25T12:00:00.000Z"));
  const result = store.saveEvaluation(
    goldenScenario.request,
    evaluateRequirement(goldenScenario.request, repository)
  );
  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "evidence-map-test"
  });
  const evidence = listEvidence(workItem.id, store);
  const mappings = mapEvidenceToRequirements({ workItem, evidence });

  const conservative = mappings.find((mapping) => mapping.requirementId === "conservative-treatment-evidence");
  assert.ok(conservative);
  assert.equal(conservative.evidenceItemId, "fixture-pt-summary-inline");
  assert.equal(conservative.mappingMethod, "fixture-tag");
  assert.equal(conservative.strength, "strong");
  assert.deepEqual(conservative.citedFields, ["therapyDuration", "failedConservativeCare"]);
  assert.match(conservative.rationale, /fixture metadata/i);

  const missing = mappings.find((mapping) => mapping.strength === "missing");
  assert.ok(missing);
  assert.equal(missing.evidenceItemId, null);
  assert.equal(missing.mappingMethod, "rule");
});
