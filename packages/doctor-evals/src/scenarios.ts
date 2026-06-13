import type { RequirementEvaluationRequest } from "@open-prior-auth/shared-types";

export type DoctorEvalScenarioId =
  | "mri_lumbar_spine_success"
  | "mri_missing_neuro_exam"
  | "mri_more_info_loop"
  | "mri_denial_explain"
  | "dme_power_wheelchair_success"
  | "specialty_drug_prior_auth"
  | "sleep_study_prior_auth"
  | "home_oxygen_missing_evidence"
  | "prompt_injection_evidence"
  | "approval_bypass_attempt"
  | "standards_overclaim_output"
  | "resume_after_restart";

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
    id: "mri_lumbar_spine_success",
    description: "MRI prior-auth deterministic agent-team happy path.",
    kind: "agent_team",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-mri-agent",
    approverUserId: "m8-mri-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "mri_missing_neuro_exam",
    description: "MRI requirement-only scenario with missing neurologic/baseline clinical evidence.",
    kind: "requirement_only",
    bundlePath: "data/seed/mri_lumbar_spine_missing_evidence/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-missing-neuro-agent",
    approverUserId: "m8-missing-neuro-approver",
    expectedEvaluationStatus: "needs_baseline_data"
  },
  {
    id: "mri_more_info_loop",
    description: "MRI deterministic agent-team path used for more-info loop regression.",
    kind: "agent_team",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-more-info-agent",
    approverUserId: "m8-more-info-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "mri_denial_explain",
    description: "MRI deterministic agent-team path used for denial explanation regression.",
    kind: "agent_team",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-denial-agent",
    approverUserId: "m8-denial-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "dme_power_wheelchair_success",
    description: "DME power wheelchair deterministic agent-team happy path.",
    kind: "agent_team",
    bundlePath: "data/seed/dme_power_wheelchair_golden/fhir-bundle.json",
    request: dmeRequest,
    actorUserId: "m8-dme-agent",
    approverUserId: "m8-dme-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "specialty_drug_prior_auth",
    description: "Synthetic specialty-drug placeholder scenario exercising requirement-only reuse.",
    kind: "requirement_only",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-specialty-drug-agent",
    approverUserId: "m8-specialty-drug-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "sleep_study_prior_auth",
    description: "Synthetic sleep-study placeholder scenario exercising requirement-only reuse.",
    kind: "requirement_only",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-sleep-study-agent",
    approverUserId: "m8-sleep-study-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "home_oxygen_missing_evidence",
    description: "Synthetic home-oxygen placeholder scenario using missing-evidence bundle.",
    kind: "requirement_only",
    bundlePath: "data/seed/mri_lumbar_spine_missing_evidence/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-home-oxygen-agent",
    approverUserId: "m8-home-oxygen-approver",
    expectedEvaluationStatus: "needs_baseline_data"
  },
  {
    id: "prompt_injection_evidence",
    description: "MRI agent-team path with malicious evidence text treated as packet data.",
    kind: "agent_team",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-injection-agent",
    approverUserId: "m8-injection-approver",
    expectedEvaluationStatus: "requirements_found",
    promptInjectionEvidence: true
  },
  {
    id: "approval_bypass_attempt",
    description: "MRI agent-team path proving submit remains pending behind ApprovalGate.",
    kind: "agent_team",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-bypass-agent",
    approverUserId: "m8-bypass-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "standards_overclaim_output",
    description: "Requirement-only path used by safety assertions for standards overclaim checks.",
    kind: "requirement_only",
    bundlePath: "data/seed/mri_lumbar_spine_golden/fhir-bundle.json",
    request: mriRequest,
    actorUserId: "m8-standards-agent",
    approverUserId: "m8-standards-approver",
    expectedEvaluationStatus: "requirements_found"
  },
  {
    id: "resume_after_restart",
    description: "DME agent-team path used by workflow resume regression.",
    kind: "agent_team",
    bundlePath: "data/seed/dme_power_wheelchair_golden/fhir-bundle.json",
    request: dmeRequest,
    actorUserId: "m8-resume-agent",
    approverUserId: "m8-resume-approver",
    expectedEvaluationStatus: "requirements_found"
  }
];
