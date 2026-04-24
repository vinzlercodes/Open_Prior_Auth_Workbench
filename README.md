# Open Prior Auth Workbench

M1 is a synthetic-data-only requirements sandbox for MRI lumbar spine prior authorization. It is CRD-inspired, but it does not claim CDS Hooks CRD or production SMART App Launch conformance.

## What Runs in M1

- A Next.js web app with a SMART-style launch shim.
- A TypeScript API with deterministic requirement evaluation.
- A checked-in MRI lumbar spine golden scenario.
- Explicit work-item creation from a stored `evaluationId`.
- Fixture-backed FHIR R4 resources that preserve the Medplum/FHIR boundary for later replacement.

## Local Commands

```bash
npm install
npm test
npm run dev:api
npm run dev:web
```

The API defaults to `http://localhost:4000`. The web app defaults to `http://localhost:3000` and reads `NEXT_PUBLIC_API_BASE_URL` when set.

## M1 API

- `GET /health`
- `GET /context/patient/:id`
- `POST /requirements/evaluate`
- `POST /work-items`
- `GET /work-items/:id`

`POST /requirements/evaluate` is deterministic and side-effect free with respect to work-item creation. It registers the exact evaluation result under an `evaluationId`; `POST /work-items` then references that stored result without recomputing requirements.

## Data Posture

All checked-in data is synthetic. Do not use real PHI in this repository.
