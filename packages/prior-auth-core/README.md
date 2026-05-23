# Prior Auth Core

README-only M0 placeholder.

This planned package will own provider-side prior authorization Use Cases and ports. It becomes a real package in M1a. Do not add `package.json`, `tsconfig.json`, source files, or build config in M0.

Boundary rules:

- owns Prior Authorization Case Use Cases
- does not import `apps/*`
- exposes Use Cases for HTTP routes and ToolNet tools as sibling adapters
- keeps `PriorAuthorizationCase` as domain root and `WorkItem` as queue projection
