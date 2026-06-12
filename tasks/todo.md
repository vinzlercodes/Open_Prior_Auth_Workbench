# Active Work

## North-Star Audit Cleanup

### Plan

- [x] Read `open_prior_auth_workbench_strategy_report.pdf`, especially section 3.
- [x] Compare report north-star against current docs, source, tests, demos, and package state.
- [x] Use subagents for independent docs/status/verification review.
- [x] Replace stale historical todo content with active work only.
- [x] Create `tasks/audit.md` as the current canonical audit artifact.
- [x] Record gaps and stale-doc risks without editing README, roadmap, or architecture docs in this pass.
- [x] Re-run `npm test`.
- [x] Re-run `npm run typecheck`.
- [x] Re-run `npm run build`.
- [x] Re-run `npm run evals`.
- [x] Confirm `git status --short` only shows intended audit/todo edits.

### Review

- `tasks/audit.md` now records the PDF north-star, current implementation status, gap matrix, documentation drift, and verification evidence.
- `tasks/todo.md` was reset from historical milestone log to current active tracker.
- Historical M0-M9 implementation notes, old partial audits, stale "pause to execute M0" item, and in-progress domain grilling leftovers were removed from active todo state.
- Verification passed: `npm test` 87/87, `npm run typecheck`, `npm run build`, and `npm run evals` 4/4 scenarios with 88/88 assertions.
- Documentation sync pass updated stale status language across root docs, roadmap, architecture docs, demo docs, package READMEs, production-path docs, compose notes, and subagent prompts.
- Verification after documentation sync passed: `npm test` 87/87, `npm run typecheck`, `npm run build`, and `npm run evals` 4/4 scenarios with 88/88 assertions.

## Active Follow-Ups

- [x] Sync stale status docs called out in `tasks/audit.md`: root docs, package READMEs, roadmap, architecture docs, demo story, compose notes, and active audit notes.
- [ ] Decide whether `packages/doctor-mcp` should remain a placeholder or become the next implementation milestone.
- [ ] Decide whether to add dedicated UI/e2e coverage for the Agent Cockpit beyond build/typecheck and API-backed contract tests.
- [ ] Decide whether to split `apps/api/src/storage/sqliteStore.ts` into smaller repositories after the runtime/API hardening pass.

## Genesis Architecture Review

### Plan

- [x] Run Genesis environment and repository probe.
- [x] Inspect package graph, application boundaries, tests, demos, and docs.
- [x] Search architecture-critical flows and package dependencies.
- [x] Identify architecture strengths, structural risks, and missing production gates.
- [x] Verify findings with local commands where practical.
- [x] Add review notes and verification results.

### Review

- Added `tasks/genesis_architecture_review.md`.
- Main architecture risks: `doctor-runtime` is coupled to prior-auth despite workflow-agnostic positioning, API/storage/web adapter files are becoming large structural bottlenecks, local HTTP mutation routes bypass ApprovalGate, and CI lacks security/quality gates needed before live integrations.
- Strengths: package direction is coherent, domain language is strong, core use cases are adapter-friendly, standards non-conformance is explicit, transaction/idempotency behavior is tested, and evals cover safety claims/tool policy.
- Verification passed: `npm test` 87/87 after localhost permission, `npm run typecheck`, `npm run build`, and `npm run evals` 4/4 scenarios with 88/88 assertions.

## Genesis Architecture Hardening

### Plan

- [x] Create `packages/prior-auth-agent-team` and move prior-auth agent workflow out of `doctor-runtime`.
- [x] Make `doctor-runtime` depend on a generic runtime tool catalog instead of ToolNet/Prior Auth Core.
- [x] Add `OPEN_PRIOR_AUTH_EXECUTION_MODE=production` guard for local-only mutation and submit routes.
- [x] Split API agent-run and standards helpers out of `apps/api/src/server.ts`.
- [x] Split web API client and cockpit response types out of `apps/web/app/page.tsx`.
- [x] Add portable CI security workflow and immutable action pin tests.
- [x] Run final `npm test`, `npm run typecheck`, `npm run build`, and `npm run evals`.

### Review

- `packages/prior-auth-agent-team` now owns the deterministic prior-auth workflow and ToolNet runtime bridge.
- `packages/doctor-runtime` now uses a generic `RuntimeToolCatalog` and has no source imports from ToolNet, Prior Auth Core, `apps/*`, localhost, fetch, or HTTP clients.
- `OPEN_PRIOR_AUTH_EXECUTION_MODE=production` blocks local-only unauthenticated mutation/submit routes with `403 OperationOutcome`; local mode remains default.
- API server logic was reduced by moving agent-run/cockpit response shaping and standards helpers into route modules. Web page API client and cockpit response types were split out of `page.tsx`.
- Added portable security workflow with CodeQL, dependency review, gitleaks, and action pin audit; workflows now use immutable action SHAs.
- Verification passed: `npm test` 92/92, `npm run typecheck`, `npm run build`, and `npm run evals` 4/4 scenarios with 88/88 assertions.
