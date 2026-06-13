import type {
  EvidenceListResponse,
  EvidenceMapping,
  WorkItem
} from "@open-prior-auth/shared-types";
import { findRulePackForRequest } from "../rules/rulePack.js";

export interface EvidenceMappingInput {
  workItem: WorkItem;
  evidence: EvidenceListResponse;
}

export function mapEvidenceToRequirements(input: EvidenceMappingInput): EvidenceMapping[] {
  const rulePack = findRulePackForRequest({
    payerId: input.workItem.payerId,
    serviceLine: input.workItem.serviceLine
  });
  const requirements = rulePack?.rules[0]?.requiredClinicalContext ?? input.workItem.requirementResult.missingData;

  return requirements.map((requirement) => {
    const fixture = input.evidence.availableFixtures.find((candidate) =>
      candidate.supportsRequirementIds?.includes(requirement.code)
    );
    const attachment = input.evidence.attachments.find((candidate) =>
      fixture?.fixtureId && candidate.fixtureId === fixture.fixtureId
    );

    if (fixture) {
      return {
        id: `emap-${input.workItem.id}-${requirement.code}`,
        caseId: input.workItem.id,
        evidenceItemId: attachment?.id ?? fixture.fixtureId,
        requirementId: requirement.code,
        mappingMethod: "fixture-tag",
        strength: fixture.evidenceStrength ?? "strong",
        rationale: `Evidence fixture metadata links ${fixture.fixtureId} to requirement ${requirement.code}.`,
        citedFields: fixture.citedFields ?? [],
        acceptedBy: attachment?.acceptedAt ? "local-reviewer" : undefined,
        acceptedAt: attachment?.acceptedAt,
        createdAt: input.workItem.createdAt
      };
    }

    return {
      id: `emap-${input.workItem.id}-${requirement.code}`,
      caseId: input.workItem.id,
      evidenceItemId: null,
      requirementId: requirement.code,
      mappingMethod: "rule",
      strength: "missing",
      rationale: `No attached or available evidence fixture declares support for requirement ${requirement.code}.`,
      citedFields: [],
      createdAt: input.workItem.createdAt
    };
  });
}

export function checkEvidenceGaps(input: EvidenceMappingInput): EvidenceMapping[] {
  return mapEvidenceToRequirements(input).filter((mapping) => mapping.strength === "missing");
}
