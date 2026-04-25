# Open Prior Auth Workbench

M4 is a synthetic-data-only prior authorization workbench for MRI lumbar spine prior authorization. It preserves the M1 requirement-discovery sandbox, M2 local DTR-inspired form workspace, and M3 PAS-style local packet builder, then adds an operations layer for queueing, aging, payer updates, more-info loops, structured denial reasons, and CMS-aligned synthetic metrics.

The `/dtr/*` endpoints are intentionally local DTR-like product endpoints. The `/pas/*` endpoints are intentionally PAS-style local product endpoints. They are not implementations of the FHIR `$questionnaire-package` operation, Da Vinci PAS `$submit`, production SMART App Launch, CDS Hooks CRD, or production payer transport.

## What Runs in M4

- A Next.js web app with a local operations queue, metrics panel, form workspace, packet builder, and mock payer action controls.
- A TypeScript API with deterministic requirement evaluation, local questionnaire packaging, PAS-style packet build, mock submission, and operations APIs.
- A checked-in MRI lumbar spine golden scenario with synthetic FHIR R4 seed data.
- Explicit separation between internal `WorkItem.status` and payer `PayerUpdate.status`.
- Queue `effectiveStatus` derived exactly as `latestPayerUpdate.status === "pended" && workItem.status === "submitted" ? "pended" : workItem.status`.
- Transition-matrix enforcement for internal workflow status changes.
- First-class operation events for payer status, more-info requests, more-info resolution, assignment, and cancellation.
- Structured denial reasons with `code`, `display`, `detail`, and `source: "mock-payer"`.
- Explicit `submittedAt`, `decidedAt`, and `decisionTimeMs` fields for payer-cycle metrics.
- More-info loops that reopen the evidence workspace, resolve back to `review_ready`, require a fresh packet, and keep stale packet submission blocked.

## Local Commands

```bash
npm install
npm test
npm run dev:api
npm run dev:web
```

The API defaults to `http://localhost:4000`. The web app defaults to `http://localhost:3000` and reads `NEXT_PUBLIC_API_BASE_URL` when set.

## API Surface

- `GET /health`
- `GET /context/patient/:id`
- `POST /requirements/evaluate`
- `POST /work-items`
- `GET /work-items?status=submitted,pended&owner=unassigned&sort=age_desc`
- `GET /work-items/:id`
- `POST /dtr/package`
- `POST /dtr/save-response`
- `POST /pas/build-packet`
- `POST /pas/submit`
- `GET /work-items/:id/status`
- `GET /work-items/:id/audit`
- `GET /work-items/:id/operations`
- `POST /work-items/:id/request-more-info`
- `POST /work-items/:id/record-payer-status`
- `GET /operations/metrics`
- `POST /demo/seed-work-items`

`POST /work-items/:id/record-payer-status` records synthetic mock-payer `pended`, `approved`, `denied`, or `cancelled` updates. Denied updates require a structured denial reason.

`POST /work-items/:id/request-more-info` moves a submitted or payer-pended case to `more_info_needed`, records requested items, and leaves the payer update history intact.

`GET /operations/metrics` returns provider-side queue metrics plus CMS-aligned synthetic metrics such as approval rate, denial rate, pended rate, more-info rate, and average/median submission-to-decision time.

## Not Implemented in M4

- No production SMART App Launch.
- No real CDS Hooks / CRD endpoint conformance.
- No real FHIR `$questionnaire-package` operation.
- No real Da Vinci PAS `$submit`, PAS inquiry, or payer endpoint discovery.
- No X12 278 generation or transmission.
- No durable database, Temporal workflow engine, or Medplum-backed persistence.
- No real payer decisions; payer updates are synthetic mock-payer events.
- No real PHI; synthetic fixtures only.

## Data Posture

All checked-in data is synthetic. Do not use real PHI in this repository.
