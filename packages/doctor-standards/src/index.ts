export type StandardsFamily = "SMART" | "CDS Hooks" | "CRD" | "DTR" | "PAS" | "FHIR";

export interface StandardsCapability {
  id: string;
  route: string;
  internalTool: string;
  standardFamily: StandardsFamily;
  supportedFixtureFields: string[];
  unsupportedProductionRequirements: string[];
  operationOutcomeBehavior: string;
  testFixturePath: string;
  conformanceClaimAllowed: false;
}

const capabilities: readonly StandardsCapability[] = [
  {
    id: "smart-discovery",
    route: "/.well-known/smart-configuration",
    internalTool: "local-standards.launch.smartConfiguration",
    standardFamily: "SMART",
    supportedFixtureFields: ["authorization_endpoint", "token_endpoint", "capabilities"],
    unsupportedProductionRequirements: ["OAuth client registration", "token issuance", "real EHR launch"],
    operationOutcomeBehavior: "Read-only discovery returns explicit local non-conformance metadata.",
    testFixturePath: "data/standards/smart-discovery.local.json",
    conformanceClaimAllowed: false
  },
  {
    id: "crd-discover-services",
    route: "/cds-services",
    internalTool: "doctor.crd.discover_services",
    standardFamily: "CDS Hooks",
    supportedFixtureFields: ["services", "hook", "id"],
    unsupportedProductionRequirements: ["production CDS Hooks auth", "payer endpoint discovery"],
    operationOutcomeBehavior: "Discovery remains local and non-conformant.",
    testFixturePath: "data/standards/crd-order-sign.request.json",
    conformanceClaimAllowed: false
  },
  {
    id: "crd-invoke-service",
    route: "/cds-services/{id}",
    internalTool: "doctor.crd.invoke_service",
    standardFamily: "CRD",
    supportedFixtureFields: ["hook", "context", "prefetch"],
    unsupportedProductionRequirements: ["real payer CRD rules", "SMART bearer auth", "FHIR validation"],
    operationOutcomeBehavior: "Invalid service ids and malformed fixture calls return OperationOutcome-like errors.",
    testFixturePath: "data/standards/crd-order-sign.request.json",
    conformanceClaimAllowed: false
  },
  {
    id: "dtr-questionnaire-package",
    route: "/fhir/Questionnaire/$questionnaire-package",
    internalTool: "doctor.dtr.get_questionnaire_package_fhir",
    standardFamily: "DTR",
    supportedFixtureFields: ["Parameters", "Questionnaire", "QuestionnaireResponse"],
    unsupportedProductionRequirements: ["FHIR operation conformance", "terminology services", "payer-hosted packages"],
    operationOutcomeBehavior: "Missing Parameters return OperationOutcome-like required/invalid errors.",
    testFixturePath: "data/standards/dtr-questionnaire-package.parameters.json",
    conformanceClaimAllowed: false
  },
  {
    id: "pas-claim-submit",
    route: "/fhir/Claim/$submit",
    internalTool: "doctor.pas.submit_claim_fhir_mock",
    standardFamily: "PAS",
    supportedFixtureFields: ["Claim", "ClaimResponse", "Bundle"],
    unsupportedProductionRequirements: ["X12 278", "payer transport", "PAS certification"],
    operationOutcomeBehavior: "Local mock submit returns ClaimResponse-shaped bundle or OperationOutcome-like error.",
    testFixturePath: "data/standards/pas-claim-submit.bundle.json",
    conformanceClaimAllowed: false
  },
  {
    id: "evidence-document-reference",
    route: "/work-items/{id}/evidence",
    internalTool: "doctor.evidence.list",
    standardFamily: "FHIR",
    supportedFixtureFields: ["DocumentReference", "Binary", "Bundle"],
    unsupportedProductionRequirements: ["real FHIR persistence", "document repository integration"],
    operationOutcomeBehavior: "Unknown work item returns OperationOutcome-like not-found.",
    testFixturePath: "data/evidence/mri-lumbar-spine.evidence-fixtures.json",
    conformanceClaimAllowed: false
  }
];

export function listStandardsCapabilities(): readonly StandardsCapability[] {
  return capabilities;
}

export function getStandardsCapability(id: string): StandardsCapability {
  const capability = capabilities.find((candidate) => candidate.id === id);
  if (!capability) {
    throw new Error(`Unknown standards capability: ${id}`);
  }
  return capability;
}
