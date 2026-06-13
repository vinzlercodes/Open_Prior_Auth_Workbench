# Agent Runner

Status: Partial.

Doctor Runtime now exposes generic runner, planner, handoff, output validation, model adapter, and run-resumer interfaces. The prior-auth package wraps the deterministic scripted team with `DeterministicPriorAuthReplayPlanner`.

Default demo mode remains deterministic replay. Live-local model planning is interface-only and intentionally not enabled.
