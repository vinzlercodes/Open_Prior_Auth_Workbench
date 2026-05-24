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

## M3 Deterministic Prior-Auth Agent Team

M3 adds a replayable scripted prior-auth agent team inside `packages/doctor-runtime`. The team has deterministic role classes for orchestration, requirement discovery, documentation, evidence review, packet assembly, and compliance boundary checks.

The MRI happy path runs over Runtime + ToolNet only:

1. List queue rows.
2. Read the prior authorization case.
3. Re-run requirement evaluation from case context.
4. Get the DTR questionnaire package.
5. Fill the remaining MRI questionnaire answers and pause for guarded save approval.
6. Apply a scripted approval for questionnaire save.
7. List evidence.
8. Build the PAS-style packet preview.
9. Request guarded mock submit approval and stop at `waiting_for_human`.

The final submit is not auto-approved in M3. This preserves ApprovalGate as the compliance boundary while still proving the deterministic team can create a packet preview without a live LLM.

## Non-Goals

- No Postgres in M2.
- No Temporal in M2.
- No JSON-file runtime state.
- No prior-auth schema rename.
- No broad multi-agent platform before the prior-auth path is proven.
