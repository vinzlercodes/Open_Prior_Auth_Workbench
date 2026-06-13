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
  {
    name: "doctor.case.get",
    category: "case",
    description: "Get the prior authorization case root for a work item.",
    riskLevel: "read",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: workItemIdInputSchema,
    outputSchema: outputObjectSchema("PriorAuthorizationCase.")
  },
  {
    name: "doctor.queue.list_work_items",
    category: "queue",
    description: "List operational work item queue rows.",
    riskLevel: "read",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: queueListInputSchema,
    outputSchema: outputArraySchema("Work item queue rows.")
  },
  {
    name: "doctor.case.get_status_timeline",
    category: "case",
    description: "Get status transition timeline for a work item.",
    riskLevel: "read",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: workItemIdInputSchema,
    outputSchema: outputArraySchema("Status events.")
  },
  {
    name: "doctor.case.get_audit_trace",
    category: "case",
    description: "Get audit trace events for a work item.",
    riskLevel: "read",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: workItemIdInputSchema,
    outputSchema: outputArraySchema("Audit events.")
  },
  {
    name: "doctor.evidence.list",
    category: "evidence",
    description: "List available and attached evidence for a work item.",
    riskLevel: "read",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: workItemIdInputSchema,
    outputSchema: outputObjectSchema("EvidenceListResponse.")
  },
  {
    name: "doctor.requirements.evaluate",
    category: "requirements",
    description: "Run local requirement evaluation and save the evaluation run.",
    riskLevel: "draft",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: requirementsEvaluateInputSchema,
    outputSchema: outputObjectSchema("RequirementEvaluationResult.")
  },
  {
    name: "doctor.crd.discover_services",
    category: "crd",
    description: "List local non-conformant CDS Hooks CRD-shaped services.",
    riskLevel: "read",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: emptyInputSchema,
    outputSchema: outputObjectSchema("CdsServicesResponse with explicit non-conformance metadata.")
  },
  {
    name: "doctor.crd.invoke_service",
    category: "crd",
    description: "Invoke a local non-conformant CRD-shaped CDS Hooks service over requirement evaluation.",
    riskLevel: "draft",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: crdInvokeInputSchema,
    outputSchema: outputObjectSchema("CdsHooksResponse with local requirement evaluation card.")
  },
  {
    name: "doctor.dtr.get_questionnaire_package",
    category: "dtr",
    description: "Get or initialize the local DTR questionnaire package for a work item.",
    riskLevel: "draft",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: workItemIdInputSchema,
    outputSchema: outputObjectSchema("QuestionnairePackage.")
  },
  {
    name: "doctor.dtr.get_questionnaire_package_fhir",
    category: "dtr",
    description: "Get a local non-conformant FHIR Parameters-shaped DTR questionnaire package.",
    riskLevel: "draft",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: workItemIdInputSchema,
    outputSchema: outputObjectSchema("FHIR Parameters-shaped local DTR questionnaire package.")
  },
  {
    name: "doctor.pas.build_packet",
    category: "pas",
    description: "Build a PAS-style local submission packet draft.",
    riskLevel: "draft",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: packetBuildInputSchema,
    outputSchema: outputObjectSchema("SubmissionPacket.")
  },
  {
    name: "doctor.pas.build_claim_submit_bundle",
    category: "pas",
    description: "Build a local non-conformant FHIR Claim submit Bundle from a packet preview.",
    riskLevel: "draft",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: packetBuildInputSchema,
    outputSchema: outputObjectSchema("FHIR Claim submit Bundle wrapper.")
  },
  {
    name: "doctor.dtr.save_response",
    category: "dtr",
    description: "Guarded questionnaire response save contract.",
    riskLevel: "guarded_write",
    approval: {
      approvalRequired: true,
      blockedCode: APPROVAL_EXECUTOR_REQUIRED,
      reason: "Saving questionnaire responses changes case state and waits for M2 ApprovalGate."
    },
    executable: false,
    inputSchema: questionnaireSaveInputSchema,
    outputSchema: outputObjectSchema("Guarded tool error.")
  },
  {
    name: "doctor.pas.submit_mock",
    category: "pas",
    description: "Guarded mock PAS submit contract.",
    riskLevel: "guarded_submit",
    approval: {
      approvalRequired: true,
      blockedCode: APPROVAL_EXECUTOR_REQUIRED,
      reason: "Submitting packets changes payer-facing state and waits for M2 ApprovalGate."
    },
    executable: false,
    inputSchema: packetSubmitInputSchema,
    outputSchema: outputObjectSchema("Guarded tool error.")
  },
  {
    name: "doctor.pas.submit_claim_fhir_mock",
    category: "pas",
    description: "Guarded local non-conformant FHIR Claim submit mock contract.",
    riskLevel: "guarded_submit",
    approval: {
      approvalRequired: true,
      blockedCode: APPROVAL_EXECUTOR_REQUIRED,
      reason: "Submitting a standards-shaped Claim changes payer-facing state and requires ApprovalGate."
    },
    executable: false,
    inputSchema: claimSubmitInputSchema,
    outputSchema: outputObjectSchema("FHIR ClaimResponse Bundle wrapper.")
  },
  {
    name: "doctor.pas.map_claim_response_to_runtime_receipt",
    category: "pas",
    description: "Map a local ClaimResponse Bundle into runtime receipt-shaped output without persisting state.",
    riskLevel: "read",
    approval: { approvalRequired: false },
    executable: true,
    inputSchema: claimResponseMapInputSchema,
    outputSchema: outputObjectSchema("Runtime receipt-shaped ClaimResponse mapping.")
  }
];

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
