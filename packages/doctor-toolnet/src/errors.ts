import type { DoctorToolError } from "./types.js";

export const APPROVAL_EXECUTOR_REQUIRED = "APPROVAL_EXECUTOR_REQUIRED";

export function approvalExecutorRequired(toolName: string): DoctorToolError {
  return {
    code: APPROVAL_EXECUTOR_REQUIRED,
    message: `Tool ${toolName} requires an approval executor before it can run.`
  };
}

export function toDoctorToolError(error: unknown): DoctorToolError {
  if (error instanceof Error) {
    return {
      code: error.name || "TOOL_EXECUTION_FAILED",
      message: error.message
    };
  }

  return {
    code: "TOOL_EXECUTION_FAILED",
    message: "Tool execution failed.",
    details: error
  };
}
