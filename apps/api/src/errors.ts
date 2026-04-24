import type { LocalOperationOutcome } from "@open-prior-auth/shared-types";

export class OperationOutcomeError extends Error {
  readonly statusCode: number;
  readonly outcome: LocalOperationOutcome;

  constructor(statusCode: number, code: string, diagnostics: string) {
    super(diagnostics);
    this.statusCode = statusCode;
    this.outcome = operationOutcome("error", code, diagnostics);
  }
}

export function operationOutcome(
  severity: LocalOperationOutcome["issue"][number]["severity"],
  code: string,
  diagnostics: string
): LocalOperationOutcome {
  return {
    resourceType: "OperationOutcome",
    issue: [
      {
        severity,
        code,
        diagnostics
      }
    ]
  };
}
