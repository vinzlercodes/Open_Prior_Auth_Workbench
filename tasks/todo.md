# M1 Standards Sandbox Tracker

## Plan
- [x] Create the TypeScript monorepo scaffold outside `doctor/`.
- [x] Add shared request/result contracts for requirement evaluation and work-item creation.
- [x] Add the MRI lumbar spine golden scenario with synthetic FHIR R4 seed data.
- [x] Implement deterministic, side-effect-free requirement evaluation with a generated `evaluationId`.
- [x] Implement `POST /work-items` so it creates a case from the stored evaluation result without recomputing.
- [x] Build the SMART-style launch shim UI, context view, evaluation result view, explicit work-item action, and queue shell.
- [x] Add tests for the golden scenario, contract behavior, missing-data paths, unsupported service lines, and evaluation/work-item separation.
- [x] Keep auth, context, and FHIR resource boundaries compatible with later SMART/ONC g(10)-style testing.
- [x] Future M2 seam: replace launch shim with true SMART/CDS Hooks-compatible boundary.
- [x] Add `demo/` artifacts with reproduction steps, test instructions, expected outputs, and sample-data pointers.

## Review
- `npm test` passed: 5 contract/unit tests covering the golden scenario, no work item on evaluation, work item from stored `evaluationId`, unsupported service line, and missing conservative-treatment evidence.
- `npm run typecheck` passed across API, web, and shared-types workspaces.
- `npm run build` passed across API, web, and shared-types workspaces.
- Manual API verification passed:
  - `GET /health` returned `status: ok`.
  - `POST /requirements/evaluate` returned `eval-8a673eae6c28942c` with `requirements_found`.
  - `POST /work-items` created `wi-8a673eae6c28` from the stored evaluation result.
- Manual UI server verification passed: Next.js served `http://localhost:3000` with HTTP 200.
- Demo artifact added at `demo/README.md` with UI and API reproduction steps, expected `evaluationId`/work-item outputs, verification commands, and links to the synthetic golden scenario data.
- Remaining M1 caveat: the FHIR layer is fixture-backed to preserve the Medplum boundary without blocking the milestone on self-hosted infrastructure.
