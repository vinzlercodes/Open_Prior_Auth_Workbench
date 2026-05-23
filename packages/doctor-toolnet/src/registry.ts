import { APPROVAL_EXECUTOR_REQUIRED } from "./errors.js";
import {
  outputArraySchema,
  outputObjectSchema,
  packetBuildInputSchema,
  packetSubmitInputSchema,
  questionnaireSaveInputSchema,
  queueListInputSchema,
  requirementsEvaluateInputSchema,
  workItemIdInputSchema
} from "./schemas.js";
import type { DoctorToolDefinition, DoctorToolName } from "./types.js";

const tools: readonly DoctorToolDefinition[] = [
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
  }
];

export function listDoctorTools(): readonly DoctorToolDefinition[] {
  return tools;
}

export function getDoctorToolDefinition(name: DoctorToolName): DoctorToolDefinition {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) {
    throw new Error(`Unknown Doctor ToolNet tool: ${name}`);
  }
  return tool;
}
