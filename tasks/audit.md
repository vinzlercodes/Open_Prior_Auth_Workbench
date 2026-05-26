# North-Star Implementation Audit

Audit date: May 26, 2026

Primary source: `open_prior_auth_workbench_strategy_report.pdf`, especially section 3, "Revised goal, scope, and north-star separation."

## Executive Finding

The repository had drifted ahead of several stale docs and todo entries. The current codebase implements much of the report's synthetic open-source agentic target: Prior Auth Core, Doctor ToolNet, Doctor Runtime with ApprovalGate, deterministic prior-auth agent team, Agent Cockpit, standards-shaped gateway routes, Doctor Evals, and production-path documentation.

The project still correctly does not meet the production implementation north star. It remains synthetic-only, local-first, non-certified, not PHI-ready, and disconnected from live EHR and payer systems. The biggest implementation gap is Doctor MCP; the biggest documentation risk was status drift.

## PDF North-Star Summary

Section 3 defines three separated layers:

| Layer | Report expectation | Current read |
| --- | --- | --- |
| Agentic OSS target | Complete local system running supervised agents over synthetic prior-auth cases, with custom runtime, tool broker, MCP server, workflow engine, cockpit, evals, and standards-shaped tools. | Mostly implemented, except MCP server remains placeholder and cockpit has no eval dashboard. |
| Standards-shaped interface harness | Routes and payloads mirroring SMART, CRD/CDS Hooks, DTR, PAS, and FHIR concepts with conformance/gap matrix and OperationOutcome-style errors. | Implemented as local non-conformant gateway/routes and ToolNet standards-shaped tools. |
| Production implementation north star | Architecture, interfaces, security model, migration path for real deployment. | Documented in `docs/production-path/`; not implemented, intentionally. |

The report says to build now: MRI prior-auth vertical slice, custom runtime, tool runtime, MCP server, standards gateway, agent cockpit, and evaluation harness. It also says to avoid production claims: no real PHI, no certified Da Vinci implementation, no live payer submission, no production MCP security posture, and no autonomous clinical decision-maker claim.

## Current Implementation Status

| Capability | Status | Evidence |
| --- | --- | --- |
| Prior-auth domain core | Implemented. Domain root, payer-facing request/update/determination models, Use Cases, ports, evidence, questionnaire, packet, status, audit. | `packages/prior-auth-core/src/domain.ts`, `packages/prior-auth-core/src/useCases.ts`, `tests/prior-auth-core.contract.test.mjs` |
| Doctor ToolNet | Implemented. Registry, schemas, risk/approval metadata, read/draft tools, guarded write/submit tools, standards-shaped CRD/DTR/PAS tools. | `packages/doctor-toolnet/src/registry.ts`, `packages/doctor-toolnet/src/executor.ts`, `packages/doctor-toolnet/src/standards.ts`, `tests/doctor-toolnet.contract.test.mjs` |
| Doctor Runtime + ApprovalGate | Implemented. Runs, tasks, tool call records, approval requests/decisions, trace events, SQLite runtime store, guarded pause/resume/reject. | `packages/doctor-runtime/src/types.ts`, `packages/doctor-runtime/src/runtime.ts`, `packages/doctor-runtime/src/sqliteRuntimeStore.ts`, `tests/doctor-runtime.contract.test.mjs` |
| Deterministic prior-auth agent team | Implemented. Orchestrator, requirement, documentation, evidence, packet, and compliance roles run over Runtime + ToolNet. | `packages/doctor-runtime/src/priorAuthAgentTeam.ts`, `tests/doctor-runtime.contract.test.mjs` |
| Agent Cockpit | Implemented as one Next.js page with case-first state, scenario switcher, queue/case details, agent run timeline, evidence board, approvals, packet preview, status/audit traces. | `apps/web/app/page.tsx`, `apps/api/src/server.ts`, `tests/agent-cockpit.contract.test.mjs` |
| Standards Gateway | Implemented as explicit local non-conformant HTTP adapters and standards-shaped ToolNet tools. | `apps/api/src/server.ts`, `packages/doctor-toolnet/src/standards.ts`, `docs/standards/conformance-matrix.md`, `tests/standards-gateway.contract.test.mjs` |
| Doctor Evals | Implemented. Four deterministic scenarios, golden trace diffs, policy assertions, safety assertions, JSON/Markdown reports, `npm run evals`. | `packages/doctor-evals/src/scenarios.ts`, `packages/doctor-evals/src/policy.ts`, `packages/doctor-evals/reports/latest.md`, `tests/doctor-evals.contract.test.mjs` |
| Production-path docs | Implemented as docs-only M9 path. | `docs/production-path/README.md`, `docs/production-path/fhir-data-plane.md`, `docs/production-path/security-authz-audit.md`, `docs/production-path/ehr-payer-integration.md`, `docs/production-path/deployment-observability.md`, `docs/production-path/conformance-test-path.md` |
| Doctor MCP | Not implemented. README-only placeholder and architecture doc only. | `packages/doctor-mcp/README.md`, `docs/architecture/mcp.md` |

## Gap Matrix

| Gap | Why it matters | Truth-grounded status |
| --- | --- | --- |
| MCP server | PDF OSS target includes local stdio MCP server exposing safe tools/resources/prompts. | Not implemented; package is README-only placeholder. |
| Production PHI/EHR/payer path | PDF production north star requires real auth, data plane, payer/EHR integration, security, operations. | Documented only; correctly not implemented. |
| Certified standards conformance | Report wants standards-shaped credibility but no false certification claim. | Local gateway exists; all docs and payloads should continue saying non-conformant. |
| Eval dashboard | PDF cockpit target mentions eval dashboard. | Formal eval CLI/reports exist; no UI dashboard. |
| Dedicated UI/e2e tests | Cockpit has contract/build coverage, but no Playwright/Vitest/Jest UI runner. | Current scripts use Node test runner, TypeScript, Next build, and deterministic evals. |
| Documentation drift | Stale docs can mislead implementers and users about current north-star progress. | Highest cleanup risk after this audit. |

## Documentation Drift Findings

- Resolved in the documentation sync pass: `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `docs/roadmap.md`, `docs/architecture/doctor-agent-os.md`, `docs/architecture/strategy_report_implementation_audit.md`, `docs/architecture/mcp.md`, `docs/demo/agentic-story-flow.md`, `packages/doctor-mcp/README.md`, and `infra/compose/README.md` now describe the current implementation status.
- Previous `tasks/todo.md` mixed active todo, milestone history, old audits, and stale open items; it has been reset to active work only.
- Historical archive docs under `docs/architecture/archive/` intentionally remain unchanged as archived point-in-time records.

## Safety And Conformance Boundary

The project remains:

- synthetic-only
- local-first
- standards-shaped, not certified
- explicitly non-conformant for current SMART/CRD/DTR/PAS/FHIR surfaces
- not PHI-ready
- not connected to live EHRs or payers
- not a production healthcare automation platform
- not an autonomous clinical decision-maker

This matches the PDF's required north-star separation. Current implementation should keep preserving `conformance: false`, `productionConformance: false`, and local non-conformance language on standards-shaped routes and tools.

## Verification

Current verification for this audit pass:

- `npm test`: passed 87/87 tests with localhost permission. Initial sandboxed run failed only because route tests could not bind `127.0.0.1`.
- `npm run typecheck`: passed across workspaces.
- `npm run build`: passed across workspaces, including Next.js production build.
- `npm run evals`: passed 4/4 scenarios and 88/88 assertions.

Verification coverage proves local synthetic behavior, package boundaries, ToolNet/runtime ApprovalGate behavior, standards-shaped routes, deterministic evals, and current source build health. It does not prove production standards conformance, PHI readiness, live payer transport, live EHR integration, or production security posture.
