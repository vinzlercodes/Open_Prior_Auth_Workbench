# Open Prior Auth Workbench

M2 is a synthetic-data-only, local DTR-inspired form workspace for MRI lumbar spine prior authorization. It preserves the M1 requirement-discovery sandbox and adds a questionnaire package, editable prefills, draft saving, validation, and review-ready transition.

The `/dtr/*` endpoints are intentionally local DTR-like product endpoints. They are not implementations of the FHIR `$questionnaire-package` operation, production SMART App Launch, CDS Hooks CRD, or PAS submission.

## What Runs in M2

- A Next.js web app with the M1 SMART-style launch shim plus an M2 form workspace.
- A TypeScript API with deterministic requirement evaluation and local DTR-inspired questionnaire packaging.
- A checked-in MRI lumbar spine golden scenario with synthetic FHIR R4 seed data.
- Explicit work-item creation from a stored `evaluationId`.
- Editable QuestionnaireResponse drafts with FHIR status kept separate from app work-item status.
- Prefill provenance from Patient, Coverage, ServiceRequest, Condition, and Observation.
- OperationOutcome-like error responses for local DTR workflow failures.

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
- `GET /work-items/:id`
- `POST /dtr/package`
- `POST /dtr/save-response`

`POST /requirements/evaluate` is deterministic and side-effect free with respect to work-item creation. `POST /work-items` references the stored result without recomputing requirements.

`POST /dtr/package` creates or reuses a questionnaire session for a work item and returns a local DTR-like package with Questionnaire, draft QuestionnaireResponse, empty Library/ValueSet dependency arrays, prefill metadata, validation, completion, and local session metadata.

`POST /dtr/save-response` requires `revision`, persists incomplete drafts, detects stale saves, and only moves the work item to `review_ready` when validation passes.

## M2 Non-goals

- No production SMART App Launch.
- No CDS Hooks / CRD endpoint conformance.
- No real FHIR `$questionnaire-package` operation.
- No CQL execution.
- No adaptive questionnaire `$next-question`.
- No PAS submission.
- No external payer authentication or endpoint discovery.
- No real PHI; synthetic fixtures only.

## Data Posture

All checked-in data is synthetic. Do not use real PHI in this repository.
