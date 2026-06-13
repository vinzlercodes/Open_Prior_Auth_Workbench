import { listDoctorTools, type DoctorToolDefinition, type DoctorToolName } from "@open-prior-auth/doctor-toolnet";

export interface DoctorMcpResourceDefinition {
  uriTemplate: string;
  name: string;
  description: string;
  readOnly: true;
}

export interface DoctorMcpPromptDefinition {
  name: string;
  description: string;
  arguments: readonly string[];
}

export interface DoctorMcpToolDefinition {
  name: DoctorToolName;
  description: string;
  inputSchema: DoctorToolDefinition["inputSchema"];
  readOnly: boolean;
}

const resources: readonly DoctorMcpResourceDefinition[] = [
  resource("doctor://cases", "Cases", "List synthetic prior authorization cases."),
  resource("doctor://cases/{id}", "Case", "Read one synthetic prior authorization case."),
  resource("doctor://cases/{id}/audit", "Case Audit", "Read ordered audit events for one case."),
  resource("doctor://cases/{id}/evidence", "Case Evidence", "Read available and attached evidence for one case."),
  resource("doctor://cases/{id}/packet-preview", "Packet Preview", "Read latest local PAS-style packet preview for one case."),
  resource("doctor://evals/scenarios", "Eval Scenarios", "List deterministic Doctor Eval scenarios."),
  resource("doctor://evals/golden-traces/{id}", "Golden Trace", "Read normalized golden trace for one eval scenario.")
];

const prompts: readonly DoctorMcpPromptDefinition[] = [
  prompt("run_prior_auth_case", "Plan a supervised synthetic prior-auth case run.", ["caseId"]),
  prompt("find_missing_evidence", "Identify missing evidence from local requirement and evidence data.", ["caseId"]),
  prompt("summarize_agent_trace", "Summarize an agent trace for a reviewer.", ["runId"]),
  prompt("explain_payer_denial", "Explain a mock payer denial using synthetic status and audit data.", ["caseId"]),
  prompt("prepare_more_info_response", "Draft a supervised more-info response plan.", ["caseId"])
];

export function listDoctorMcpResources(): readonly DoctorMcpResourceDefinition[] {
  return resources;
}

export function listDoctorMcpPrompts(): readonly DoctorMcpPromptDefinition[] {
  return prompts;
}

export function listDoctorMcpTools(): readonly DoctorMcpToolDefinition[] {
  return listDoctorTools()
    .filter((tool) => tool.mcpExposure === "read-only")
    .map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      readOnly: tool.riskLevel === "read"
    }));
}

export function isDoctorMcpToolExposed(name: DoctorToolName): boolean {
  return listDoctorMcpTools().some((tool) => tool.name === name);
}

function resource(uriTemplate: string, name: string, description: string): DoctorMcpResourceDefinition {
  return { uriTemplate, name, description, readOnly: true };
}

function prompt(name: string, description: string, args: readonly string[]): DoctorMcpPromptDefinition {
  return { name, description, arguments: args };
}
