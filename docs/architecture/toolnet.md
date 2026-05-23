# Doctor ToolNet

Doctor ToolNet is the agent-facing tool adapter over Use Cases. M1b makes `packages/doctor-toolnet` a real workspace package over `prior-auth-core`.

## Purpose

ToolNet tools expose prior-auth Use Cases with:

- stable tool names
- input/output schemas
- risk levels
- approval metadata
- traceable call records
- deterministic error contracts

## Adapter Rule

ToolNet tools call Use Cases directly. They do not fetch `localhost`, call internal API routes, or bypass Prior Auth Core.

## M1b Implementation

The package exports `listDoctorTools`, `getDoctorToolDefinition`, `createDoctorToolRegistry`, and `executeDoctorTool`. Tool dependencies are Prior Auth Core ports: `PriorAuthStore` and `ClinicalContextRepository`, plus optional clock, id generator, and evidence upload directory.

Executable read/draft tools call Prior Auth Core directly:

- `doctor.case.get`
- `doctor.queue.list_work_items`
- `doctor.case.get_status_timeline`
- `doctor.case.get_audit_trace`
- `doctor.evidence.list`
- `doctor.requirements.evaluate`
- `doctor.dtr.get_questionnaire_package`
- `doctor.pas.build_packet`

Declared but non-executable guarded tools:

- `doctor.dtr.save_response`
- `doctor.pas.submit_mock`

Guarded tools return deterministic `APPROVAL_EXECUTOR_REQUIRED` until Doctor Runtime adds ApprovalGate in M2. They are visible contracts, not executable case-changing actions.

Each call returns a traceable call record with call id, tool name, category, risk level, approval flag, status, timestamps, input, and output or error.

## Non-Goals

- No approval executor in M1b.
- No MCP exposure in M1b.
- No live payer submission.
- No case-changing tool execution before ApprovalGate.
