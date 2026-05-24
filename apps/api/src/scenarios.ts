import { readdirSync, readFileSync } from "node:fs";
import type { RequirementEvaluationRequest } from "@open-prior-auth/shared-types";
import { resolveFromRepoRoot } from "./config/paths.js";

export interface GoldenScenario {
  scenarioId: string;
  description: string;
  publicName?: string;
  bundlePath: string;
  rulePackPath: string;
  request: RequirementEvaluationRequest;
  expected?: {
    evaluationId: string;
    evaluationStatus: string;
    requiresPriorAuth: boolean;
    requiresDocs: boolean;
    matchedRuleId: string;
    rulePackVersion: string;
    nextAction: string;
    missingDataCount: number;
  };
}

export const DEFAULT_SCENARIO_ID = "mri-lumbar-spine-golden";

export function listGoldenScenarios(): GoldenScenario[] {
  const directory = resolveFromRepoRoot("data/fixtures/golden-scenarios");
  return readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => JSON.parse(readFileSync(`${directory}/${file}`, "utf8")) as GoldenScenario);
}

export function getGoldenScenario(scenarioId = DEFAULT_SCENARIO_ID): GoldenScenario {
  const scenario = listGoldenScenarios().find((candidate) => candidate.scenarioId === scenarioId);
  if (!scenario) {
    throw new Error(`Unknown golden scenario: ${scenarioId}`);
  }
  return scenario;
}
