# Doctor ToolNet

README-only M0 placeholder.

This planned package will expose Use Cases as agent-facing ToolNet tools with schemas, risk metadata, approval metadata, and traceable call records. It becomes a real package in M1b. Do not add `package.json`, `tsconfig.json`, source files, or build config in M0.

Boundary rules:

- calls Use Cases directly
- does not call internal HTTP routes
- does not import `apps/*`
- keeps guarded write/submit tools non-executable until ApprovalGate exists
