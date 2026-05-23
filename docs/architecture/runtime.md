# Doctor Runtime

Doctor Runtime is the workflow-agnostic runtime package for agent runs, tasks, approvals, tool call records, and trace events.

## Target Primitives

- `AgentRun`
- `AgentTask`
- `TaskPlan`
- `ToolCallRecord`
- `ApprovalRequest`
- `ApprovalDecision`
- `TraceEvent`

## Persistence

M2 adds SQLite runtime tables:

- `agent_runs`
- `agent_tasks`
- `tool_call_records`
- `approval_requests`
- `agent_trace_events`

`agent_trace_events` is the canonical ordered runtime trace stream. Task, tool, and approval tables are structured state/index tables. Runtime migrations use `doctor_runtime_schema_migrations`, separate from prior-auth schema migrations.

## ApprovalGate

Guarded ToolNet write/submit tools pause the run and create approval requests. Approval records trace events, executes the guarded Prior Auth Core Use Case, and resumes the run. Rejection records trace events, rejects the run, and leaves prior-auth case state unchanged.

## Non-Goals

- No Postgres in M2.
- No Temporal in M2.
- No JSON-file runtime state.
- No prior-auth schema rename.
- No broad multi-agent platform before the prior-auth path is proven.
