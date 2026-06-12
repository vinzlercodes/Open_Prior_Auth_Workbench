# Doctor Agent OS

Doctor Agent OS is the implementation substrate for agentic healthcare administrative workflow software. In this repository, it is scoped to the Open Prior Auth Agent Workbench and must not be described as a broader committed product domain.

## Current State

The current runnable product includes the M1-M8 synthetic prior authorization workbench plus M9 production-path documentation. Prior Auth Core, Doctor ToolNet, Doctor Runtime with ApprovalGate, deterministic prior-auth agent team, Agent Cockpit, standards-shaped gateway routes, and Doctor Evals exist. Doctor MCP remains a README-only placeholder and is the main unimplemented Doctor Agent OS boundary.

## Target Responsibilities

- Host workflow-agnostic agent runtime primitives.
- Expose Use Cases through ToolNet tools with schemas, risk metadata, approval metadata, and call records.
- Gate write/submit actions through ApprovalGate.
- Persist ordered traces for debugging, replay, and audit.
- Run deterministic safety/regression evals.
- Expose selected ToolNet tools through MCP in a future milestone.

## Package Direction

- `packages/prior-auth-core`: provider-side prior authorization Use Cases and ports.
- `packages/doctor-toolnet`: agent-facing tool registry and contracts over Use Cases.
- `packages/doctor-runtime`: workflow-agnostic run/task/approval/trace state and generic tool-catalog execution boundary.
- `packages/prior-auth-agent-team`: deterministic prior-auth agent workflow and ToolNet bridge over Doctor Runtime.
- `packages/doctor-mcp`: external MCP boundary over selected ToolNet tools.
- `packages/doctor-evals`: deterministic regression and safety harness.

`apps/*` may import `packages/*`. `packages/*` must not import `apps/*`.

## Non-Goals

- No PHI-ready claim.
- No certified SMART, CRD, DTR, or PAS conformance claim.
- No live EHR or payer integration.
- No generic healthcare marketplace scope in the near term.
- No production implementation; production-path docs are guidance only.
