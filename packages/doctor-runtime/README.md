# Doctor Runtime

Doctor Runtime owns workflow-agnostic agent runs, tasks, tool call records, approval requests, approval decisions, and trace events.

## M2 Runtime Surface

- `AgentRun`
- `AgentTask`
- `TaskPlan`
- `ToolCallRecord`
- `ApprovalRequest`
- `ApprovalDecision`
- `TraceEvent`
- `SqliteRuntimeStore`
- `createDoctorRuntime`
- `executeRuntimeTool`
- `approveApprovalRequest`
- `rejectApprovalRequest`

## Persistence

Runtime SQLite tables are separate from prior-auth case tables:

- `agent_runs`
- `agent_tasks`
- `tool_call_records`
- `approval_requests`
- `agent_trace_events`

`agent_trace_events` is the canonical ordered trace stream. Task, tool, and approval tables are structured state/index tables. Runtime migrations use `doctor_runtime_schema_migrations` so they can share a SQLite file with prior-auth storage without colliding.

## ApprovalGate

Guarded ToolNet tools pause the run, create an approval request, and do not mutate case state. Approval executes the guarded Prior Auth Core Use Case and resumes the run. Rejection records trace state and leaves prior-auth case state unchanged.
