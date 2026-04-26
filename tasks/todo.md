# Open Prior Auth Workbench Audit

## M6 Durable Standards Boundary

### Plan

- [x] Add M6 task tracking while preserving the prior audit and M5 notes.
- [x] Pin Node runtime support to `>=22.18.0` and exact CI lines for Node `22.18.x` and `24.2.x`.
- [x] Add a `PriorAuthStore` interface and make `MemoryStore` test/demo-only through that interface.
- [x] Implement SQLite migrations, schema constraints, explicit transactions, and `SqliteStore`.
- [x] Make the API default to SQLite with `OPEN_PRIOR_AUTH_DB_PATH` and `.data/open-prior-auth.sqlite`.
- [x] Add local launch/CRD/DTR/PAS adapter boundaries without changing response shapes.
- [x] Add `db:migrate`, `db:reset`, and `demo:seed` commands.
- [x] Add M6 architecture docs and demo restart-survival guidance.
- [x] Add SQLite parity, restart-survival, and transaction rollback tests.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.

### Review

- Added the `PriorAuthStore` boundary, made `SqliteStore` the default API store, and kept `MemoryStore` available for fast isolated tests.
- Added constrained SQLite migrations with `STRICT` tables, `FOREIGN KEY`, `UNIQUE`, `NOT NULL`, `CHECK`, and `json_valid(...)` constraints for JSON text columns.
- Added explicit transaction wrapping for multi-table case lifecycle writes, including packet build/submit, payer status updates, more-info resolution, status events, operation events, and audit writes.
- Added local launch, CRD-inspired, DTR-inspired, and PAS-style adapter classes with explicit non-conformance names while preserving existing endpoint response shapes.
- Added `npm run db:migrate`, `npm run db:reset`, and `npm run demo:seed`; verified each command sequentially and reset the local ignored SQLite DB afterward.
- Updated README, demo guide, `.env.example`, and M6 architecture docs for Node `>=22.18.0`, exact CI versions, SQLite defaults, restart survival, and local boundaries.
- Verification: `npm test` passed 42/42 tests with localhost permission for route-level API tests.
- Verification: `npm run typecheck` passed across API, web, and shared-types workspaces.
- Verification: `npm run build` passed across API, web, and shared-types workspaces.

## Plan

- [x] Extract and outline `open_prior_auth_workbench_strategy_report.pdf`.
- [x] Inventory the implemented repo surface: API, web app, shared package, fixtures, tests, docs, infra, and demo assets.
- [x] Map each report section and proposed capability to concrete implementation evidence.
- [x] Identify unimplemented, partial, ambiguous, and out-of-scope items.
- [x] Verify the current build/test state before finalizing the audit.
- [x] Write a detailed audit report with remaining work and recommended next steps.

## Review

- Extracted the 14-page PDF report to text and rendered pages under `tmp/pdfs/` for audit review, then removed the temporary render files after writing the durable audit.
- Audited the implementation against the report section by section, including PRD, workflows, architecture, stack, integrations, data model, API surface, repo structure, roadmap, risks, and remaining work.
- Added the detailed audit to `docs/architecture/strategy_report_implementation_audit.md`.
- Confirmed the implementation covers the M1-M5 synthetic local workbench path, centered on one MRI lumbar spine payer-rule/questionnaire scenario.
- Confirmed the major remaining gaps are production SMART/CRD/DTR/PAS conformance, durable persistence, Temporal, Medplum/HAPI, auth/authz, document/AI/attachments, observability, real payer/EHR integrations, and multi-service-line expansion.
- Verification: initial sandboxed `npm test` failed because API route tests could not bind `127.0.0.1`; rerunning with localhost permission passed 38/38 tests.
- Verification: `npm run typecheck` passed across API, web, and shared-types workspaces.
- Verification: `npm run build` passed across API, web, and shared-types workspaces.

## Prior Completed Work

### M5 OSS Polish Tracker

- Verified the existing repo-root `LICENSE` is Apache-2.0 and referenced it from `README.md`.
- Added M5 OSS-facing docs: `CONTRIBUTING.md`, humble `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.env.example`, `data/README.md`, `docs/architecture/m5_oss_polish.md`, and `examples/automations/README.md`.
- Added GitHub Actions CI with Node 22 and Node 24 matrix coverage and the expected install, test, typecheck, and build steps.
- Updated `demo/README.md` and added `demo/screenshots/README.md` with deterministic screenshot scope, seed command, actual checked-in capture dimensions, preferred future desktop viewport, and proof points.
- Captured seven requested PNG screenshots in `demo/screenshots/` and removed temporary JPEG capture files after user approval.
- Verified all local markdown links in M5 docs resolve.
- `npm test` passed with 38 tests using localhost permission for route-level API tests.
- `npm run typecheck` passed across API, web, and shared-types workspaces.
- `npm run build` passed across API, web, and shared-types workspaces.
- Local smoke verification passed: API health returned `status: ok`, the web app returned HTTP 200 on port 3001, demo seeding created one synthetic case, and the queue returned one row.
