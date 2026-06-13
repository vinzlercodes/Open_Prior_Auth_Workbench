import {
  createPriorAuthRuntimeToolCatalog,
  runDeterministicPriorAuthAgentTeam
} from "@open-prior-auth/prior-auth-agent-team";
import {
  SqliteRuntimeStore,
  type ApprovalRequest
} from "@open-prior-auth/doctor-runtime";
import type {
  AgentCockpitApprovalSummary,
  AgentCockpitRequirementEvidenceRow,
  AgentCockpitRunResponse,
  EvidenceListResponse
} from "@open-prior-auth/shared-types";
import {
  findRulePackForRequest,
  getPriorAuthorizationCase,
  getQuestionnairePackage,
  listEvidence,
  mapEvidenceToRequirements,
  OperationOutcomeError,
  type PriorAuthStore
} from "@open-prior-auth/prior-auth-core";
import { defaultDatabasePath } from "../storage/sqliteStore.js";
import { FixtureFhirRepository } from "../fhir/fixtureRepository.js";

export async function runPriorAuthCockpitAgent(
  input: { workItemId: string; actorUserId?: string },
  repository: FixtureFhirRepository,
  store: PriorAuthStore,
  runtimeStorePath: string | undefined
): Promise<AgentCockpitRunResponse> {
  if (!input.workItemId) {
    throw new OperationOutcomeError(400, "required", "workItemId is required.");
  }

  const runtimeStore = new SqliteRuntimeStore(runtimeStorePath ?? defaultDatabasePath());
  try {
    const result = await runDeterministicPriorAuthAgentTeam({
      workItemId: input.workItemId,
      actorUserId: input.actorUserId ?? "m5-cockpit-operator",
      questionnaireApprovalActorUserId: "m5-scripted-approver"
    }, {
      runtimeStore,
      toolCatalog: createPriorAuthRuntimeToolCatalog({
        repository,
        store
      })
    });
    const caseRoot = getPriorAuthorizationCase(result.workItemId, store);
    const questionnairePackage = getQuestionnairePackage({ workItemId: result.workItemId }, repository, store);
    const evidence = listEvidence(result.workItemId, store);

    return {
      run: result.run,
      workItem: caseRoot.workItem,
      caseStatus: caseRoot.lifecycleStatus,
      requirementEvaluation: result.requirementEvaluation,
      questionnairePackage,
      evidence,
      evidenceBoard: buildEvidenceBoard(caseRoot.workItem, evidence),
      packet: result.packet,
      receipt: caseRoot.submissionReceipts.at(-1) ?? null,
      questionnaireApproval: summarizeApproval(result.questionnaireApprovalRequest),
      submitApproval: summarizeApproval(result.submitApprovalRequest),
      steps: result.steps,
      trace: result.trace,
      statusTimeline: caseRoot.statusTimeline,
      auditTrace: caseRoot.auditTrace
    };
  } finally {
    runtimeStore.close();
  }
}

function summarizeApproval(approval: ApprovalRequest): AgentCockpitApprovalSummary {
  return {
    id: approval.id,
    toolName: approval.toolName,
    riskLevel: approval.riskLevel,
    status: approval.status,
    reason: approval.reason,
    requestedBy: approval.requestedBy,
    requestedAt: approval.requestedAt,
    decidedBy: approval.decision?.decidedBy,
    decidedAt: approval.decision?.decidedAt,
    decisionReason: approval.decision?.reason
  };
}

function buildEvidenceBoard(
  workItem: Awaited<ReturnType<typeof getPriorAuthorizationCase>>["workItem"],
  evidence: EvidenceListResponse
): AgentCockpitRequirementEvidenceRow[] {
  const rulePack = findRulePackForRequest({
    payerId: workItem.payerId,
    serviceLine: workItem.serviceLine
  });
  const requirements = rulePack?.rules[0]?.requiredClinicalContext ?? workItem.requirementResult.missingData;
  const mappings = mapEvidenceToRequirements({ workItem, evidence });

  return requirements.map((requirement) => {
    const rowMappings = mappings.filter((mapping) => mapping.requirementId === requirement.code);
    const matchingAttachments = evidence.attachments.filter((attachment) =>
      evidenceMatchesRequirement(attachment.title, attachment.filename, requirement.code, requirement.resourceType)
      || rowMappings.some((mapping) => mapping.evidenceItemId === attachment.id || mapping.evidenceItemId === attachment.fixtureId)
    );
    const matchingFixtures = evidence.availableFixtures.filter((fixture) =>
      evidenceMatchesRequirement(fixture.title, fixture.filename, requirement.code, requirement.resourceType)
      || rowMappings.some((mapping) => mapping.evidenceItemId === fixture.fixtureId)
    );
    const packetAttachments = matchingAttachments.filter((attachment) => attachment.status === "included-in-packet");
    const acceptedAttachments = matchingAttachments.filter((attachment) => attachment.status === "accepted");
    const attachedAttachments = matchingAttachments.filter((attachment) => attachment.status === "attached");
    const missing = workItem.requirementResult.missingData.some((item) => item.code === requirement.code);

    return {
      requirementCode: requirement.code,
      requirementLabel: requirement.label,
      requirementDetail: requirement.detail,
      resourceType: requirement.resourceType,
      status: packetAttachments.length > 0
        ? "included-in-packet"
        : acceptedAttachments.length > 0
          ? "accepted"
          : attachedAttachments.length > 0
            ? "attached"
            : missing
              ? "missing"
              : matchingFixtures.length > 0
                ? "available"
                : "satisfied",
      sourceLabel: sourceLabelForRequirement(requirement.resourceType, workItem.requirementResult.requestSummary),
      evidenceAttachmentIds: matchingAttachments.map((attachment) => attachment.id),
      fixtureIds: matchingFixtures.map((fixture) => fixture.fixtureId),
      mappings: rowMappings,
      strongestEvidence: strongestEvidence(rowMappings),
      rationale: rowMappings.find((mapping) => mapping.strength !== "missing")?.rationale ?? rowMappings[0]?.rationale,
      citedFields: [...new Set(rowMappings.flatMap((mapping) => mapping.citedFields))]
    };
  });
}

function strongestEvidence(
  mappings: ReturnType<typeof mapEvidenceToRequirements>
): "strong" | "weak" | "contradictory" | "missing" | undefined {
  if (mappings.some((mapping) => mapping.strength === "strong")) {
    return "strong";
  }
  if (mappings.some((mapping) => mapping.strength === "weak")) {
    return "weak";
  }
  if (mappings.some((mapping) => mapping.strength === "contradictory")) {
    return "contradictory";
  }
  if (mappings.some((mapping) => mapping.strength === "missing")) {
    return "missing";
  }
  return undefined;
}

function evidenceMatchesRequirement(
  title: string,
  filename: string,
  requirementCode: string,
  resourceType: string
): boolean {
  if (resourceType === "Condition") {
    return false;
  }
  const haystack = `${title} ${filename}`.toLowerCase();
  if (requirementCode.includes("conservative")) {
    return haystack.includes("conservative") || haystack.includes("mri");
  }
  if (requirementCode.includes("functional") || requirementCode.includes("mobility")) {
    return haystack.includes("mobility") || haystack.includes("wheelchair") || haystack.includes("dme");
  }
  return false;
}

function sourceLabelForRequirement(
  resourceType: string,
  summary: { diagnosisSummary?: string; evidenceSummary?: string }
): string {
  if (resourceType === "Condition") {
    return summary.diagnosisSummary ?? "No diagnosis context loaded";
  }
  if (resourceType === "Observation") {
    return summary.evidenceSummary ?? "No observation context loaded";
  }
  return "No source context loaded";
}
