# Doctor Runtime

Doctor Runtime is the planned workflow-agnostic runtime package for agent runs, tasks, approvals, tool call records, and trace events. It becomes real in M2; M0 only documents the boundary and creates a README placeholder.

## Target Primitives

- `AgentRun`
- `AgentTask`
- `TaskPlan`
- `ToolCallRecord`
- `ApprovalRequest`
- `ApprovalDecision`
- `TraceEvent`

## Persistence Direction

M2 adds SQLite runtime tables:

- `agent_runs`
- `agent_tasks`
- `tool_call_records`
- `approval_requests`
- `agent_trace_events`

`agent_trace_events` is the canonical ordered runtime trace stream. Task, tool, and approval tables are structured state/index tables.

## ApprovalGate

Guarded write/submit tools pause the run and create approval requests. Approval or rejection records trace events and resumes or rejects the run. This keeps agent action visible and human-controlled.

## Non-Goals

- No Postgres in M2.
- No Temporal in M2.
- No JSON-file runtime state.
- No prior-auth schema rename.
- No broad multi-agent platform before the prior-auth path is proven.
