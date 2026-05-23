# Doctor ToolNet

Doctor ToolNet is the planned agent-facing tool adapter over Use Cases. It becomes real in M1b; M0 only documents the boundary and creates a README placeholder.

## Purpose

ToolNet tools expose prior-auth and platform Use Cases with:

- stable tool names
- input/output schemas
- risk levels
- approval metadata
- traceable call records
- deterministic error contracts

## Adapter Rule

ToolNet tools call Use Cases directly. They do not fetch `localhost`, call internal API routes, or bypass Prior Auth Core.

## M1b Tool Shape

Executable read/draft tools:

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

Guarded tools return deterministic `APPROVAL_EXECUTOR_REQUIRED` until Doctor Runtime adds ApprovalGate.

## Non-Goals

- No approval executor in M1b.
- No MCP exposure in M1b.
- No live payer submission.
- No case-changing tool execution before ApprovalGate.
