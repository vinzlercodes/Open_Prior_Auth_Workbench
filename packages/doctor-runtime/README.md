# Doctor Runtime

README-only M0 placeholder.

This planned package will own workflow-agnostic agent runs, tasks, tool call records, approval requests, approval decisions, and trace events. It becomes a real package in M2. Do not add `package.json`, `tsconfig.json`, source files, or build config in M0.

Boundary rules:

- `agent_trace_events` will be the canonical ordered trace stream
- task/tool/approval tables will be structured state/index tables
- guarded ToolNet tools pause for human approval
