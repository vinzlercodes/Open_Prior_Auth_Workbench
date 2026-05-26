# M6 Durable Standards Boundary

> Pre-agentic baseline note: this document describes the preserved M6 local prior-auth workbench baseline before the Doctor Agent OS roadmap reset. See [../roadmap.md](../roadmap.md) for current M0-M9 direction.

## Boundary

M6 turns the local synthetic workbench from process-memory state into a SQLite-backed durable sandbox while preserving the existing M1-M5 API and web behavior. SQLite is the runtime source of truth for local case state. JSON remains the format for checked-in fixtures, golden snapshots, imports, exports, and demos.

M6 also introduces local standards-shaped adapter boundaries for launch/context, CRD-inspired requirement evaluation, DTR-inspired questionnaire packaging, and PAS-style packet submission. These adapters make future conformance work explicit without claiming production SMART, CDS Hooks, Da Vinci DTR, Da Vinci PAS, X12, payer endpoint discovery, payer authentication, or real EHR integration.

## Runtime Policy

The minimum supported runtime is Node `>=22.18.0`. CI tests `22.18.x` and `24.2.x` exactly because the API uses built-in `node:sqlite` without extra flags and relies on `DatabaseSync` options available in those Node lines. Node 23 is intentionally not documented as supported because it is end-of-life.

The default database path is `.data/open-prior-auth.sqlite`. Set `OPEN_PRIOR_AUTH_DB_PATH` to use a different local SQLite file.

## Persistence Design

`PriorAuthStore` is the application-owned storage boundary. `SqliteStore` is the default API store after M6. `MemoryStore` remains available only for fast unit tests and isolated service tests.

The SQLite schema uses practical `STRICT` tables with `FOREIGN KEY`, `UNIQUE`, `NOT NULL`, and `CHECK` constraints. FHIR-heavy payloads, questionnaire responses, packet bundles, response bundles, operation details, and audit snapshots are stored as JSON text with `json_valid(...)` checks.

The durable tables are:

- `requirement_runs`
- `work_items`
- `questionnaire_sessions`
- `submission_packets`
- `submission_receipts`
- `status_events`
- `payer_updates`
- `more_info_requests`
- `operation_events`
- `audit_events`
- `schema_migrations`

Idempotency is protected by schema constraints: one work item per evaluation, one packet per packet snapshot, and one receipt per packet.

## Transaction Policy

All multi-table lifecycle writes use explicit transactions. Packet build, packet submit, more-info request and resolution, payer status updates, status events, operation events, and audit writes commit atomically. If one step fails, SQLite rolls the full transaction back so partially applied case state is not exposed to the queue, audit trail, or operations metrics.

WAL mode is deferred. M6 stays local-file and single-host oriented.

## Local Standards Adapters

The API routes through local adapters without changing response shapes:

- Launch/context: `local-launch-shim-not-smart`
- Requirement evaluation: `local-crd-inspired-not-cds-hooks`
- Questionnaire package/save: `local-dtr-inspired-not-questionnaire-package`
- Packet build/submit: `local-pas-style-mock-not-da-vinci-pas`

These names are intentionally plain. They document the current non-conformant boundary and prevent local product endpoints from being mistaken for production standards endpoints.

## Developer Commands

```bash
npm run db:migrate
npm run db:reset
npm run demo:seed
```

`db:migrate` creates or updates the local SQLite schema. `db:reset` removes and recreates the local database. `demo:seed` inserts deterministic synthetic demo work items into the SQLite store.

## Verification

M6 added contract coverage for SQLite parity, restart survival, idempotent packet and receipt persistence, adapter behavior, and transaction rollback. The required verification remains:

```bash
npm test
npm run typecheck
npm run build
```
