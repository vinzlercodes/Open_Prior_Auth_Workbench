import { readFileSync } from "node:fs";
import { resolveFromRepoRoot } from "../config/paths.js";

export interface RequiredClinicalContext {
  code: string;
  label: string;
  resourceType: string;
  detail: string;
}

export interface PayerRule {
  id: string;
  description: string;
  requiresPriorAuth: boolean;
  requiresDocs: boolean;
  questionnaireCanonicals: string[];
  requiredClinicalContext: RequiredClinicalContext[];
}

export interface PayerRulePack {
  rulePackId: string;
  version: string;
  payerId: string;
  payerName: string;
  serviceLine: string;
  rules: PayerRule[];
}

export function loadRulePack(rulePackPath = "data/payer-rules/mri-lumbar-spine.acme-health.v1.json"): PayerRulePack {
  return JSON.parse(readFileSync(resolveFromRepoRoot(rulePackPath), "utf8")) as PayerRulePack;
}
