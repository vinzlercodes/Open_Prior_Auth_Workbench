# Doctor Agent OS

Doctor Agent OS is the planned implementation substrate for agentic healthcare administrative workflow software. In this repository, it is scoped to the Open Prior Auth Agent Workbench and must not be described as a broader committed product domain.

## Current State

M0 is documentation and scaffold alignment only. The current runnable product remains the M1-M7 synthetic prior authorization workbench. No Doctor Agent OS runtime, ToolNet implementation, MCP server, or eval package exists yet.

## Target Responsibilities

- Host workflow-agnostic agent runtime primitives.
- Expose Use Cases through ToolNet tools with schemas, risk metadata, approval metadata, and call records.
- Gate write/submit actions through ApprovalGate.
- Persist ordered traces for debugging, replay, and audit.
- Expose selected ToolNet tools through MCP.
- Run deterministic safety/regression evals.

## Package Direction

- `packages/prior-auth-core`: provider-side prior authorization Use Cases and ports.
- `packages/doctor-toolnet`: agent-facing tool registry and contracts over Use Cases.
- `packages/doctor-runtime`: workflow-agnostic run/task/approval/trace state.
- `packages/doctor-mcp`: external MCP boundary over selected ToolNet tools.
- `packages/doctor-evals`: deterministic regression and safety harness.

`apps/*` may import `packages/*`. `packages/*` must not import `apps/*`.

## Non-Goals

- No PHI-ready claim.
- No certified SMART, CRD, DTR, or PAS conformance claim.
- No live EHR or payer integration.
- No generic healthcare marketplace scope in the near term.
- No production-path docs until M9.
