export type OpenPriorAuthExecutionMode = "local" | "production";

export function currentExecutionMode(): OpenPriorAuthExecutionMode {
  return process.env.OPEN_PRIOR_AUTH_EXECUTION_MODE === "production" ? "production" : "local";
}

export function isProductionExecutionMode(): boolean {
  return currentExecutionMode() === "production";
}
