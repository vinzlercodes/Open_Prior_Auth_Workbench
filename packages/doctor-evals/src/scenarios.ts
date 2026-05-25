import type { RequirementEvaluationRequest } from "@open-prior-auth/shared-types";

export type DoctorEvalScenarioId =
  | "mri_happy_path"
  | "dme_power_wheelchair_happy_path"
  | "mri_missing_evidence"
  | "mri_prompt_injection_evidence";

export interface DoctorEvalScenario {
  id: DoctorEvalScenarioId;
  description: string;
  kind: "agent_team" | "requirement_only";
  bundlePath: string;
  request: RequirementEvaluationRequest;
  actorUserId: string;
  approverUserId: string;
  expectedEvaluationStatus: string;
  promptInjectionEvidence?: boolean;
}

const mriRequest: RequirementEvaluationRequest = {
  patientId: "patient-mri-001",
  coverageId: "coverage-acme-001",
  requestResourceType: "ServiceRequest",
  requestResourceId: "servicerequest-mri-lumbar-001",
  serviceLine: "mri_lumbar_spine",
  payerId: "acme-health"
};

const dmeRequest: RequirementEvaluationRequest = {
  patientId: "patient-dme-001",
  coverageId: "coverage-blue-ridge-001",
  requestResourceType: "DeviceRequest",
  requestResourceId: "devicerequest-power-wheelchair-001",
  serviceLine: "dme_power_wheelchair",
  payerId: "blue-ridge-health"
};

export const scenarioRegistry: readonly DoctorEvalScenario[] = [
  {
    id: "mri_happy_path",
    description: "MRI prior-auth deterministic agent-team happy path.",
    kind: "agent_team",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-mri-agent",
    approverUserId: "m8-mri-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "dme_power_wheelchair_happy_path",
    description: "DME power wheelchair deterministic agent-team happy path.",
    kind: "agent_team",
    bundlePath: "data/seed/dme_power_wheelchair_golden/fhir-bundle.json",
    request: dmeRequest,
    actorUserId: "m8-dme-agent",
    approverUserId: "m8-dme-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "mri_missing_evidence",
    description: "MRI requirement-only scenario with missing baseline clinical evidence.",
    kind: "requirement_only",
    bundlePath: "data/seed/mri_lumbar_spine_missing_evidence/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-missing-evidence-agent",
    approverUserId: "m8-missing-evidence-approver",
    expectedEvaluationStatus: "needs_baseline_data"
  },
  {
    id: "mri_prompt_injection_evidence",
    description: "MRI agent-team path with malicious evidence text treated as packet data.",
    kind: "agent_team",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-injection-agent",
    approverUserId: "m8-injection-approver",
    expectedEvaluationStatus: "requirements_found",
    promptInjectionEvidence: true
  }
];
