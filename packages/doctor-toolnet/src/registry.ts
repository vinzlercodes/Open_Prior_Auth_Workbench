import { APPROVAL_EXECUTOR_REQUIRED } from "./errors.js";
import {
  claimResponseMapInputSchema,
  claimSubmitInputSchema,
  crdInvokeInputSchema,
  emptyInputSchema,
  outputArraySchema,
  outputObjectSchema,
  packetBuildInputSchema,
  packetSubmitInputSchema,
  questionnaireSaveInputSchema,
  queueListInputSchema,
  requirementsEvaluateInputSchema,
  workItemIdInputSchema
} from "./schemas.js";
import type {
  DoctorToolDefinition,
  DoctorToolIdempotency,
  DoctorToolMcpExposure,
  DoctorToolName,
  DoctorToolSideEffect
} from "./types.js";

const priorAuthAgents = ["orchestrator", "requirement", "documentation", "evidence", "packet", "compliance"] as const;

type BaseDoctorToolDefinition = Omit<
  DoctorToolDefinition,
  "sideEffect" | "idempotency" | "mcpExposure" | "allowedAgents" | "standardsCapabilityId"
>;

const tools: readonly BaseDoctorToolDefinition[] = [
  executableTool("doctor.case.get", "case", "Get the prior authorization case root for a work item.", "read", workItemIdInputSchema, outputObjectSchema("PriorAuthorizationCase.")),
  executableTool("doctor.queue.list_work_items", "queue", "List operational work item queue rows.", "read", queueListInputSchema, outputArraySchema("Work item queue rows.")),
  executableTool("doctor.case.get_status_timeline", "case", "Get status transition timeline for a work item.", "read", workItemIdInputSchema, outputArraySchema("Status events.")),
  executableTool("doctor.case.get_audit_trace", "case", "Get audit trace events for a work item.", "read", workItemIdInputSchema, outputArraySchema("Audit events.")),
  executableTool("doctor.evidence.list", "evidence", "List available and attached evidence for a work item.", "read", workItemIdInputSchema, outputObjectSchema("EvidenceListResponse.")),
  executableTool("doctor.requirements.evaluate", "requirements", "Run local requirement evaluation and save the evaluation run.", "draft", requirementsEvaluateInputSchema, outputObjectSchema("RequirementEvaluationResult.")),
  executableTool("doctor.crd.discover_services", "crd", "List local non-conformant CDS Hooks CRD-shaped services.", "read", emptyInputSchema, outputObjectSchema("CdsServicesResponse with explicit non-conformance metadata.")),
  executableTool("doctor.crd.invoke_service", "crd", "Invoke a local non-conformant CRD-shaped CDS Hooks service over requirement evaluation.", "draft", crdInvokeInputSchema, outputObjectSchema("CdsHooksResponse with local requirement evaluation card.")),
  executableTool("doctor.dtr.get_questionnaire_package", "dtr", "Get or initialize the local DTR questionnaire package for a work item.", "draft", workItemIdInputSchema, outputObjectSchema("QuestionnairePackage.")),
  executableTool("doctor.dtr.get_questionnaire_package_fhir", "dtr", "Get a local non-conformant FHIR Parameters-shaped DTR questionnaire package.", "draft", workItemIdInputSchema, outputObjectSchema("FHIR Parameters-shaped local DTR questionnaire package.")),
  executableTool("doctor.pas.build_packet", "pas", "Build a PAS-style local submission packet draft.", "draft", packetBuildInputSchema, outputObjectSchema("SubmissionPacket.")),
  executableTool("doctor.pas.build_claim_submit_bundle", "pas", "Build a local non-conformant FHIR Claim submit Bundle from a packet preview.", "draft", packetBuildInputSchema, outputObjectSchema("FHIR Claim submit Bundle wrapper.")),
  guardedTool("doctor.dtr.save_response", "dtr", "Guarded questionnaire response save contract.", "guarded_write", questionnaireSaveInputSchema, outputObjectSchema("Guarded tool error."), "Saving questionnaire responses changes case state and waits for M2 ApprovalGate."),
  guardedTool("doctor.pas.submit_mock", "pas", "Guarded mock PAS submit contract.", "guarded_submit", packetSubmitInputSchema, outputObjectSchema("Guarded tool error."), "Submitting packets changes payer-facing state and waits for M2 ApprovalGate."),
  guardedTool("doctor.pas.submit_claim_fhir_mock", "pas", "Guarded local non-conformant FHIR Claim submit mock contract.", "guarded_submit", claimSubmitInputSchema, outputObjectSchema("FHIR ClaimResponse Bundle wrapper."), "Submitting a standards-shaped Claim changes payer-facing state and requires ApprovalGate."),
  executableTool("doctor.pas.map_claim_response_to_runtime_receipt", "pas", "Map a local ClaimResponse Bundle into runtime receipt-shaped output without persisting state.", "read", claimResponseMapInputSchema, outputObjectSchema("Runtime receipt-shaped ClaimResponse mapping."))
];

function executableTool(
  name: DoctorToolName,
  category: BaseDoctorToolDefinition["category"],
  description: string,
  riskLevel: BaseDoctorToolDefinition["riskLevel"],
  inputSchema: BaseDoctorToolDefinition["inputSchema"],
  outputSchema: BaseDoctorToolDefinition["outputSchema"]
): BaseDoctorToolDefinition {
  return {
    name,
    category,
    description,
    riskLevel,
    approval: { approvalRequired: false },
    executable: true,
    inputSchema,
    outputSchema
  };
}

function guardedTool(
  name: DoctorToolName,
  category: BaseDoctorToolDefinition["category"],
  description: string,
  riskLevel: BaseDoctorToolDefinition["riskLevel"],
  inputSchema: BaseDoctorToolDefinition["inputSchema"],
  outputSchema: BaseDoctorToolDefinition["outputSchema"],
  reason: string
): BaseDoctorToolDefinition {
  return {
    name,
    category,
    description,
    riskLevel,
    approval: {
      approvalRequired: true,
      blockedCode: APPROVAL_EXECUTOR_REQUIRED,
      reason
    },
    executable: false,
    inputSchema,
    outputSchema
  };
}

const enrichedTools = tools.map((tool) => ({
  ...tool,
  sideEffect: sideEffectFor(tool.name),
  idempotency: idempotencyFor(tool.name),
  mcpExposure: mcpExposureFor(tool),
  allowedAgents: priorAuthAgents,
  standardsCapabilityId: standardsCapabilityIdFor(tool.name)
})) satisfies readonly DoctorToolDefinition[];

export function listDoctorTools(): readonly DoctorToolDefinition[] {
  return enrichedTools;
}

export function getDoctorToolDefinition(name: DoctorToolName): DoctorToolDefinition {
  const tool = enrichedTools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Unknown Doctor ToolNet tool: ${name}`);
  }
  return tool;
}

function sideEffectFor(name: DoctorToolName): DoctorToolSideEffect {
  if (name === "doctor.dtr.save_response" || name === "doctor.pas.submit_mock" || name === "doctor.pas.submit_claim_fhir_mock") {
    return "case-state";
  }
  return "none";
}

function idempotencyFor(name: DoctorToolName): DoctorToolIdempotency {
  if (name === "doctor.pas.submit_mock" || name === "doctor.pas.submit_claim_fhir_mock") {
    return "required";
  }
  if (name === "doctor.dtr.save_response") {
    return "recommended";
  }
  return "not-applicable";
}

function mcpExposureFor(tool: BaseDoctorToolDefinition): DoctorToolMcpExposure {
  if (tool.approval.approvalRequired) {
    return "approval-gated";
  }
  return tool.riskLevel === "read" ? "read-only" : "hidden";
}

function standardsCapabilityIdFor(name: DoctorToolName): string | undefined {
  const mappings: Partial<Record<DoctorToolName, string>> = {
    "doctor.case.get": "prior-auth-case-read",
    "doctor.queue.list_work_items": "prior-auth-queue-read",
    "doctor.case.get_audit_trace": "prior-auth-audit-read",
    "doctor.evidence.list": "evidence-document-reference",
    "doctor.crd.discover_services": "crd-discover-services",
    "doctor.crd.invoke_service": "crd-invoke-service",
    "doctor.dtr.get_questionnaire_package_fhir": "dtr-questionnaire-package",
    "doctor.pas.submit_claim_fhir_mock": "pas-claim-submit"
  };
  return mappings[name] ?? "local-toolnet";
}
