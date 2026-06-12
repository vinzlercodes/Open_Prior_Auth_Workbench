import {
  invokeCrdService
} from "@open-prior-auth/doctor-toolnet";
import type {
  CdsHooksRequest,
  FhirParameters,
  QuestionnairePackageRequest
} from "@open-prior-auth/shared-types";
import {
  OperationOutcomeError,
  type PriorAuthStore
} from "@open-prior-auth/prior-auth-core";
import { FixtureFhirRepository } from "../fhir/fixtureRepository.js";

export function standardsSmartConfiguration() {
  return {
    conformance: false,
    productionConformance: false,
    mode: "local-non-conformant",
    authorization_endpoint: "http://localhost:4000/smart/authorize",
    token_endpoint: "http://localhost:4000/smart/token",
    capabilities: ["launch-ehr", "client-public"],
    scopes_supported: ["launch", "patient/*.read", "openid", "fhirUser"]
  };
}

export function invokeCrdGatewayService(
  serviceId: string,
  request: CdsHooksRequest,
  repository: FixtureFhirRepository,
  store: PriorAuthStore
) {
  try {
    return invokeCrdService({ serviceId, request }, { repository, store });
  } catch (error) {
    throw toGatewayOperationOutcome(error);
  }
}

export function resolveQuestionnairePackageWorkItemId(
  body: QuestionnairePackageRequest | FhirParameters,
  store: PriorAuthStore
): string {
  if (isRecord(body) && typeof body.workItemId === "string" && body.workItemId.length > 0) {
    return body.workItemId;
  }
  if (!isFhirParameters(body)) {
    throw new OperationOutcomeError(
      400,
      "required",
      "FHIR Questionnaire/$questionnaire-package requires workItemId or Parameters with patientId, coverageId, and requestResourceId."
    );
  }

  const patientId = parameterString(body, "patientId");
  const coverageId = parameterString(body, "coverageId");
  const requestResourceId = parameterString(body, "requestResourceId");
  if (!patientId || !coverageId || !requestResourceId) {
    throw new OperationOutcomeError(
      400,
      "invalid",
      "FHIR Questionnaire/$questionnaire-package Parameters must include patientId, coverageId, and requestResourceId."
    );
  }

  const workItem = store.listWorkItems().find((candidate) =>
    candidate.patientId === patientId
    && candidate.coverageId === coverageId
    && candidate.requestResourceId === requestResourceId
  );
  if (!workItem) {
    throw new OperationOutcomeError(
      404,
      "not-found",
      `No work item matches Questionnaire/$questionnaire-package Parameters for patient ${patientId}, coverage ${coverageId}, request ${requestResourceId}.`
    );
  }
  return workItem.id;
}

function toGatewayOperationOutcome(error: unknown): OperationOutcomeError {
  const message = error instanceof Error ? error.message : "Standards gateway request failed.";
  if (message.startsWith("Unknown local CRD service id:")) {
    return new OperationOutcomeError(404, "not-found", message);
  }
  if (message.includes(" expects hook ")) {
    return new OperationOutcomeError(400, "invalid", message);
  }
  if (message.includes(" is missing ") || message.includes(" must include ")) {
    return new OperationOutcomeError(400, "required", message);
  }
  return new OperationOutcomeError(400, "invalid", message);
}

function isFhirParameters(value: unknown): value is FhirParameters {
  return isRecord(value) && value.resourceType === "Parameters" && Array.isArray(value.parameter);
}

function parameterString(parameters: FhirParameters, name: string): string | undefined {
  const parameter = parameters.parameter?.find((candidate) => candidate.name === name);
  return typeof parameter?.valueString === "string" && parameter.valueString.length > 0
    ? parameter.valueString
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
