import type {
  MissingDataReason,
  NextAction,
  RequirementEvaluationRequest,
  RequirementEvaluationResult,
  RequestSummary
} from "@open-prior-auth/shared-types";
import type { FhirResource, FixtureFhirRepository, PatientContext } from "../fhir/fixtureRepository.js";
import { evaluationHash } from "./hash.js";
import { loadRulePack, type PayerRulePack } from "../rules/rulePack.js";

export function evaluateRequirement(
  request: RequirementEvaluationRequest,
  repository: FixtureFhirRepository,
  rulePack: PayerRulePack = loadRulePack()
): RequirementEvaluationResult {
  const context = repository.getPatientContext(
    request.patientId,
    request.coverageId,
    request.requestResourceType,
    request.requestResourceId
  );
  const requestSummary = buildRequestSummary(context, rulePack);

  if (request.serviceLine !== rulePack.serviceLine || request.payerId !== rulePack.payerId) {
    return withEvaluationId({
      evaluationStatus: "unsupported_service_line",
      requiresPriorAuth: false,
      requiresDocs: false,
      matchedRuleId: null,
      rulePackVersion: rulePack.version,
      nextAction: "select_supported_service_line",
      determinism: "deterministic",
      requestSummary,
      questionnaireCanonicals: [],
      missingData: [],
      explanatoryNotes: [
        `No M1 rule pack supports service line "${request.serviceLine}" for payer "${request.payerId}".`
      ]
    });
  }

  const rule = rulePack.rules[0];
  const missingData = findMissingData(context, rule.requiredClinicalContext);
  const hasRequiredRequestContext = Boolean(context.patient && context.coverage && context.request);
  if (!hasRequiredRequestContext) {
    missingData.push(
      ...[
        !context.patient && {
          code: "patient-context",
          label: "Patient context",
          resourceType: "Patient",
          detail: "Patient resource was not found in the selected sandbox context."
        },
        !context.coverage && {
          code: "coverage-context",
          label: "Coverage context",
          resourceType: "Coverage",
          detail: "Coverage resource was not found for the requirement evaluation."
        },
        !context.request && {
          code: "order-context",
          label: "Order context",
          resourceType: request.requestResourceType,
          detail: "Requested order resource was not found for the requirement evaluation."
        }
      ].filter((item): item is MissingDataReason => Boolean(item))
    );
  }

  const evaluationStatus = missingData.length > 0 ? "needs_baseline_data" : "requirements_found";
  const nextAction: NextAction = missingData.length > 0 ? "collect_baseline_data" : "create_work_item";

  return withEvaluationId({
    evaluationStatus,
    requiresPriorAuth: rule.requiresPriorAuth,
    requiresDocs: rule.requiresDocs,
    matchedRuleId: rule.id,
    rulePackVersion: rulePack.version,
    nextAction,
    determinism: "deterministic",
    requestSummary,
    questionnaireCanonicals: rule.questionnaireCanonicals,
    missingData,
    explanatoryNotes: [
      "M1 uses a CRD-inspired deterministic local rule pack, not production CDS Hooks CRD semantics.",
      rule.description
    ]
  });
}

function withEvaluationId(result: Omit<RequirementEvaluationResult, "evaluationId">): RequirementEvaluationResult {
  return {
    evaluationId: `eval-${evaluationHash(result)}`,
    ...result
  };
}

function findMissingData(
  context: PatientContext,
  requiredClinicalContext: MissingDataReason[]
): MissingDataReason[] {
  return requiredClinicalContext.filter((requirement) => {
    if (requirement.resourceType === "Condition") {
      return context.conditions.length === 0;
    }
    if (requirement.resourceType === "Observation") {
      return context.observations.length === 0;
    }
    return false;
  });
}

function buildRequestSummary(context: PatientContext, rulePack: PayerRulePack): RequestSummary {
  const patientName = formatHumanName(context.patient) ?? "Unknown patient";
  const serviceDescription = formatCodeText(context.request) ?? "Unknown service request";
  const diagnosisSummary = context.conditions.map(formatCodeText).filter(Boolean).join("; ") || undefined;
  const evidenceSummary = context.observations.map(formatObservation).filter(Boolean).join("; ") || undefined;

  return {
    patientName,
    serviceDescription,
    payerName: formatCoveragePayer(context.coverage) ?? rulePack.payerName,
    diagnosisSummary,
    evidenceSummary
  };
}

function formatHumanName(resource: FhirResource | null): string | null {
  const names = resource?.name as Array<{ prefix?: string[]; given?: string[]; family?: string }> | undefined;
  const name = names?.[0];
  if (!name) {
    return null;
  }
  return [...(name.prefix ?? []), ...(name.given ?? []), name.family].filter(Boolean).join(" ");
}

function formatCodeText(resource: FhirResource | null): string | null {
  const code = resource?.code as { text?: string; coding?: Array<{ display?: string; code?: string }> } | undefined;
  return code?.text ?? code?.coding?.[0]?.display ?? code?.coding?.[0]?.code ?? null;
}

function formatObservation(resource: FhirResource): string | null {
  const code = formatCodeText(resource);
  const valueString = resource.valueString as string | undefined;
  if (!code && !valueString) {
    return null;
  }
  return [code, valueString].filter(Boolean).join(": ");
}

function formatCoveragePayer(resource: FhirResource | null): string | null {
  const payor = resource?.payor as Array<{ display?: string }> | undefined;
  return payor?.[0]?.display ?? null;
}
