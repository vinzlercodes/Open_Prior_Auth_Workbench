import type {
  DoctorRuntimeDependencies,
  Planner,
  TaskPlan
} from "@open-prior-auth/doctor-runtime";
import {
  runDeterministicPriorAuthAgentTeam,
  type DeterministicPriorAuthAgentTeamRequest,
  type DeterministicPriorAuthAgentTeamResult
} from "./priorAuthAgentTeam.js";

export class DeterministicPriorAuthReplayPlanner implements Planner<{ workItemId?: string }> {
  createPlan(): TaskPlan {
    return deterministicPriorAuthReplayPlan();
  }

  nextTask(): TaskPlan {
    return deterministicPriorAuthReplayPlan();
  }

  run(
    request: DeterministicPriorAuthAgentTeamRequest,
    dependencies: DoctorRuntimeDependencies
  ): Promise<DeterministicPriorAuthAgentTeamResult> {
    return runDeterministicPriorAuthAgentTeam(request, dependencies);
  }
}

export function deterministicPriorAuthReplayPlan(): TaskPlan {
  return {
    objective: "Run deterministic prior authorization replay planner.",
    steps: [
      "List work queue.",
      "Read prior authorization case.",
      "Evaluate requirements.",
      "Prepare questionnaire response behind ApprovalGate.",
      "Map evidence to requirements.",
      "Build PAS-style packet preview.",
      "Request submit approval and pause."
    ]
  };
}
