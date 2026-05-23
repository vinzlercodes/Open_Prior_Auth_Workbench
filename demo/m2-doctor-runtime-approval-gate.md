# M2 Doctor Runtime + ApprovalGate

M2 makes `packages/doctor-runtime` a real workspace package.

## What It Proves

- Runtime primitives exist for runs, tasks, task plans, tool call records, approval requests, approval decisions, and trace events.
- Runtime SQLite state uses `agent_runs`, `agent_tasks`, `tool_call_records`, `approval_requests`, and `agent_trace_events`.
- `agent_trace_events` is the canonical ordered trace stream.
- Guarded ToolNet tools pause for approval before case mutation.
- Approval executes the guarded Prior Auth Core Use Case.
- Rejection leaves prior-auth case state unchanged.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

Expected result: all tests pass, including `tests/doctor-runtime.contract.test.mjs`.

## Runtime Story

1. `doctor.case.get` executes through ToolNet and records tool and trace state.
2. `doctor.dtr.save_response` creates an `ApprovalRequest` and sets the run/task to `waiting_for_human`.
3. Approving the request saves the questionnaire response through Prior Auth Core and resumes the run.
4. `doctor.pas.submit_mock` creates an approval request before submit.
5. Rejecting the submit keeps the receipt absent and leaves the work item `packet_ready`.
6. Approving the submit creates the mock receipt and moves the work item to `submitted`.
