import type { WorkflowStore } from "@open-prior-auth/doctor-workflow";

export function describeWorker(options: { pollIntervalMs?: number } = {}) {
  return {
    name: "open-prior-auth-local-worker",
    pollIntervalMs: options.pollIntervalMs ?? Number(process.env.DOCTOR_WORKER_POLL_INTERVAL_MS ?? 1000),
    durableWorkflow: true
  };
}

export function listPendingWorkflowRuns(store: WorkflowStore) {
  return store.listPendingRuns();
}

if (process.argv[1]?.endsWith("index.js")) {
  process.stdout.write(`${JSON.stringify(describeWorker(), null, 2)}\n`);
}
