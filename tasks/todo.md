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

## Active Follow-Ups

- [ ] Sync stale status docs called out in `tasks/audit.md`: `README.md`, `docs/roadmap.md`, `docs/architecture/doctor-agent-os.md`, `docs/architecture/strategy_report_implementation_audit.md`, and `AGENTS.md`.
- [ ] Decide whether `packages/doctor-mcp` should remain a placeholder or become the next implementation milestone.
- [ ] Decide whether to add dedicated UI/e2e coverage for the Agent Cockpit beyond build/typecheck and API-backed contract tests.
