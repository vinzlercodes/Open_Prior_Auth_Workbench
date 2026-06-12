import {
  createDoctorToolRegistry,
  submitPasClaimFhirMock,
  type DoctorToolDependencies,
  type DoctorToolExecutionRequest,
  type DoctorToolName
} from "@open-prior-auth/doctor-toolnet";
import {
  saveQuestionnaireResponse,
  submitMockPacket
} from "@open-prior-auth/prior-auth-core";
import type {
  ApprovalRequest,
  RuntimeToolCatalog,
  RuntimeToolExecutionRequest
} from "@open-prior-auth/doctor-runtime";

export function createPriorAuthRuntimeToolCatalog(dependencies: DoctorToolDependencies): RuntimeToolCatalog {
  const registry = createDoctorToolRegistry(dependencies);
  return {
    getToolDefinition(toolName: string) {
      return registry.getToolDefinition(asDoctorToolName(toolName));
    },
    executeTool(request: RuntimeToolExecutionRequest) {
      return registry.executeTool({
        toolName: asDoctorToolName(request.toolName),
        input: request.input as DoctorToolExecutionRequest["input"],
        callContext: request.callContext
      });
    },
    executeApprovedTool(approvalRequest: ApprovalRequest) {
      switch (approvalRequest.toolName) {
        case "doctor.dtr.save_response":
          return saveQuestionnaireResponse(
            approvalRequest.input as Parameters<typeof saveQuestionnaireResponse>[0],
            dependencies.repository,
            dependencies.store
          );
        case "doctor.pas.submit_mock":
          return submitMockPacket(
            approvalRequest.input as Parameters<typeof submitMockPacket>[0],
            dependencies.repository,
            dependencies.store
          );
        case "doctor.pas.submit_claim_fhir_mock":
          return submitPasClaimFhirMock(
            approvalRequest.input as Parameters<typeof submitPasClaimFhirMock>[0],
            dependencies
          );
        default:
          throw new Error(`Approval request ${approvalRequest.id} is not for a guarded prior-auth tool.`);
      }
    }
  };
}

function asDoctorToolName(toolName: string): DoctorToolName {
  return toolName as DoctorToolName;
}
