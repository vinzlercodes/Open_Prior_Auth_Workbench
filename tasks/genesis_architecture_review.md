# Genesis Architecture Review

Date: 2026-06-12

Mode: Genesis audit lens on existing codebase. No scaffold generated.

Research quality: PARTIAL. Local code/docs/tests were deeply inspected; external pitfall scan used public GitHub/web sources, but not the full Genesis 12-repo issue floor.

## Executive Summary

This project has a coherent TypeScript monorepo shape for the current synthetic prior-auth workbench:

- `packages/prior-auth-core` owns provider-side prior-auth use cases and ports.
- `packages/doctor-toolnet` adapts core use cases into agent-facing tools.
- `packages/doctor-runtime` owns run/task/tool/approval/trace state.
- `apps/api` is an HTTP adapter over core, ToolNet, runtime, fixtures, and SQLite.
- `apps/web` is a Next.js demo/cockpit UI.
- `tests` act as cross-package contract tests.

Current behavior is well covered and green. The main architecture risks are not immediate functional failures. They are scaling risks: runtime/domain coupling, monolithic adapter files, direct local write routes that bypass ApprovalGate, and missing production-grade security/quality gates.

## Findings

### P1: Runtime package is not actually workflow-agnostic

Evidence:

- `docs/architecture/runtime.md:3` says Doctor Runtime is workflow-agnostic.
- `packages/doctor-runtime/package.json:12-16` depends directly on `@open-prior-auth/doctor-toolnet`, `@open-prior-auth/prior-auth-core`, and shared prior-auth types.
- `packages/doctor-runtime/src/runtime.ts:1-11` imports ToolNet and Prior Auth Core functions.
- `packages/doctor-runtime/src/runtime.ts:397-421` hard-codes guarded prior-auth tool execution in the runtime approval path.
- `packages/doctor-runtime/src/priorAuthAgentTeam.ts:1-20` places the deterministic prior-auth agent team inside the runtime package.

Impact:

Future MCP or non-prior-auth workflows cannot reuse Doctor Runtime without pulling prior-auth dependencies and tool names. The approval executor also becomes a switch statement every time a guarded tool is added.

Recommendation:

Split generic runtime from workflow adapters:

- Keep `packages/doctor-runtime` generic: run/task/tool-call/approval/trace state plus an approved-tool executor interface.
- Move prior-auth agent team to `packages/prior-auth-agent-team` or `packages/doctor-prior-auth-runtime`.
- Register guarded executors through ToolNet/runtime dependencies instead of a runtime-owned `switch`.

### P2: Adapter files are becoming structural bottlenecks

Evidence:

- `apps/api/src/server.ts` is 633 lines and owns route matching, request parsing, standards gateway wiring, demo seeding, cockpit response shaping, evidence board derivation, and error mapping.
- `apps/api/src/storage/sqliteStore.ts` is 1167 lines and owns migrations plus every prior-auth persistence operation.
- `apps/web/app/page.tsx` is 650 lines and owns cockpit contracts, API calls, state orchestration, view rendering, and formatting.

Impact:

The current size is acceptable for a synthetic baseline, but production auth, policy checks, validation, observability, and real standards adapters will be hard to add safely if these files keep absorbing responsibilities.

Recommendation:

Use small module splits aligned with existing boundaries:

- API: route modules for `health`, `standards`, `work-items`, `evidence`, `operations`, `agent-runs`, and `demo`.
- Storage: repositories per aggregate/table group, with migration files separated from query methods.
- Web: API client, cockpit state hook, and presentational sections separated from `page.tsx`.

### P2: Direct HTTP write/submit routes bypass ApprovalGate

Evidence:

- `apps/api/src/server.ts:260-281` exposes `/pas/build-packet`, `/pas/submit`, `/pas/submit-local`, and `/fhir/Claim/$submit`.
- `apps/api/src/server.ts:241-247` exposes `/dtr/save-response`.
- ToolNet blocks guarded tools directly in `packages/doctor-toolnet/src/executor.ts:46-57`.
- Runtime approval handles guarded execution in `packages/doctor-runtime/src/runtime.ts:397-421`.
- Production-path docs require policy and approval binding for write/submit paths in `docs/production-path/security-authz-audit.md:17-23` and `docs/production-path/security-authz-audit.md:39-43`.

Impact:

For the local synthetic workbench this is intentional enough: the UI and tests need simple local mutation routes. For any pilot or hosted deployment, these routes become a bypass unless an HTTP-level policy/approval adapter wraps them.

Recommendation:

Keep direct routes explicitly local-only. Before production or PHI-like pilots:

- Add route-level auth/policy checks for every mutation.
- Route submit/write operations through a policy-bound approval service, or explicitly separate "staff UI direct write" from "agent tool guarded write" with different risk controls.
- Add tests that prove production-mode mutation endpoints reject unauthenticated or unauthorized calls.

### P2: CI lacks security and production quality gates

Evidence:

- `.github/workflows/ci.yml:33-43` runs install, tests, typecheck, and build.
- `.github/workflows/aislop.yml:28-29` runs the aislop quality gate.
- No `sonar-project.properties` or `.pre-commit-config.yaml` exists at repo root.
- `SECURITY.md:3-18` states the project has no formal security response program and is synthetic-only.

Impact:

The repo is honest about not being production/PHI-ready. The gap is acceptable today, but it should block live integrations, payer credentials, or PHI-like data.

Recommendation:

Add gates before live integration work:

- Secret scanning, SAST, dependency review, and pinned-action audit in CI.
- Pre-commit or local quality script for formatting/type/test basics.
- Sonar or equivalent quality gate if maintainers want trend tracking.
- Threat model document before any real EHR/payer credential path.

## Strengths

- Package direction is clear and mostly enforced. `README.md:80` states `apps/*` may import `packages/*`, not the reverse; `tests/prior-auth-core.contract.test.mjs` and `tests/doctor-toolnet.contract.test.mjs` include boundary tests.
- Domain language is strong. `CONTEXT.md` clearly separates Prior Authorization Case, Work Item, Prior Authorization Request, Payer Status Update, and Payer Determination.
- Core use cases are a good adapter target. `packages/prior-auth-core/src/useCases.ts:29-127` is a compact facade over services and ports.
- Standards claims are constrained. `README.md:55-61` and standards tests preserve `conformance: false` / `productionConformance: false`.
- Transaction behavior is tested. SQLite rollback, idempotency, migration, and runtime transaction release cases are covered.
- Evals add meaningful safety coverage. `npm run evals` verifies golden traces, approval gates, tool policy, prompt-injection-as-data, and false safety claims.

## External Pitfall Scan

Relevant ecosystem failures reinforce existing repo direction:

- DTR questionnaire retrieval is fragile in reference implementations: https://github.com/HL7-DaVinci/prior-auth/issues/185
- DTR conformance tests continue surfacing URL/package/library edge cases: https://github.com/inferno-framework/davinci-dtr-test-kit/issues
- SMART launch/auth flows have real integration friction: https://github.com/medplum/medplum/issues/4963
- FHIR conformance tests can fail on response shape, not just logic: https://github.com/hapifhir/hapi-fhir/issues/7385
- Da Vinci PAS is moving standards terrain, so local adapters should keep explicit non-conformance markers until external validation exists: https://build.fhir.org/ig/HL7/davinci-pas/

## Recommended Next Architecture Moves

1. Split generic runtime from prior-auth workflow code.
2. Add a runtime-approved guarded executor registry instead of hard-coded tool execution.
3. Break API server and SQLite store into bounded adapter modules before adding auth or real standards integration.
4. Add production-mode policy checks around mutation routes before any live pilot.
5. Add CI security gates before storing secrets, credentials, PHI, or payer/EHR endpoints.
6. Decide whether `packages/doctor-mcp` is next, then expose only selected ToolNet tools and resources without bypassing ApprovalGate.

## Verification

- `python3 /Users/vin/.codex/skills/genesis-architect/scripts/env_probe.py` initially failed because the skill package module was not on `PYTHONPATH`.
- `PYTHONPATH=/Users/vin/.codex/skills/genesis-architect/src python3 /Users/vin/.codex/skills/genesis-architect/scripts/env_probe.py` passed: macOS, Python 3.14.5, Node package manager detected as pnpm.
- `npm test` failed in sandbox due `listen EPERM: operation not permitted 127.0.0.1`.
- `npm test` rerun with localhost permission passed: 87/87.
- `npm run typecheck` passed.
- `npm run build` passed, including Next.js production build.
- `npm run evals` passed: 4/4 scenarios, 88/88 assertions.
