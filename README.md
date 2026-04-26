# Open Prior Auth Workbench

Open Prior Auth Workbench is a synthetic-data-only, provider-side prior authorization workbench. It demonstrates a local MRI lumbar spine prior authorization flow across requirement discovery, documentation capture, PAS-style packet assembly, operations queueing, payer status handling, and more-info loops.

The project is designed as an open-source reference implementation and developer sandbox. It is useful for learning the product shape and extending local fixtures, but it is not production healthcare infrastructure.

## Quickstart

Use Node `>=22.18.0`. CI tests the exact supported minimum lines `22.18.x` and `24.2.x` because M6 uses built-in `node:sqlite` without extra flags and relies on `DatabaseSync` options available in those lines. Node 23 is not documented as supported because it is end-of-life.

```bash
npm ci
npm run db:migrate
npm test
npm run typecheck
npm run build
```

Run the local demo in two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Open `http://localhost:3000`. The API defaults to `http://localhost:4000`. The web app reads `NEXT_PUBLIC_API_BASE_URL` when set.

The API uses SQLite by default at `.data/open-prior-auth.sqlite`. Set `OPEN_PRIOR_AUTH_DB_PATH` to use another local database file.

Useful local data commands:

```bash
npm run db:migrate
npm run db:reset
npm run demo:seed
```

## What The Milestones Do

- M1: loads a synthetic patient and order context, evaluates local payer requirements, and creates a work item from a deterministic requirement result.
- M2: opens a local DTR-inspired questionnaire workspace, prefills known fields from fixture FHIR data, validates required answers, and saves a review-ready QuestionnaireResponse.
- M3: builds a deterministic PAS-style local packet, submits it to a mock PAS transport, and records status and audit history.
- M4: adds an operations queue, aging and metrics, payer-pended status, more-info requests, structured denial reasons, and terminal outcomes.
- M5: adds OSS polish for external builders: contributor docs, humble security reporting guidance, CI, fixture indexes, deterministic screenshots, and docs-only automation recipes.
- M6: replaces the runtime in-memory store with a constrained SQLite repository, adds explicit transaction boundaries for case lifecycle writes, keeps `MemoryStore` for tests only, and introduces local standards-shaped launch/CRD/DTR/PAS adapter boundaries.

## Important Boundaries

This repository does not implement production SMART App Launch, CDS Hooks CRD, the FHIR `$questionnaire-package` operation, Da Vinci DTR, Da Vinci PAS `$submit`, X12 278, payer endpoint discovery, production payer transport, payer adjudication, production-grade durable persistence, or real EHR integration.

The `/dtr/*` endpoints are intentionally local DTR-like product endpoints. The `/pas/*` endpoints are intentionally PAS-style local product endpoints.

All checked-in data is synthetic. Do not use real PHI, real payer credentials, production EHR URLs, or production payer endpoints in this repository.

## Repository Map

- `apps/api/`: TypeScript API for fixture-backed context lookup, requirement evaluation, questionnaire packages, packet building, mock submission, SQLite-backed local persistence, and operations APIs.
- `apps/web/`: Next.js workbench UI for the synthetic end-to-end demo.
- `packages/shared-types/`: Shared TypeScript contracts used by the API and web app.
- `data/`: Synthetic FHIR bundles, golden scenarios, payer rule packs, and questionnaire fixtures.
- `docs/architecture/`: Milestone architecture notes from M1 through M6.
- `demo/`: Step-by-step demo guide and deterministic screenshot artifacts.
- `examples/automations/`: Docs-only automation recipes that call existing local APIs.
- `infra/compose/`: Lightweight compose notes for local API/web services.
- `tests/`: Contract tests for M1-M6 behavior.

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

## Builder Docs

- Demo walkthrough: [demo/README.md](demo/README.md)
- Screenshot guide: [demo/screenshots/README.md](demo/screenshots/README.md)
- Fixture index: [data/README.md](data/README.md)
- M6 architecture note: [docs/architecture/m6_durable_standards_boundary.md](docs/architecture/m6_durable_standards_boundary.md)
- M5 architecture note: [docs/architecture/m5_oss_polish.md](docs/architecture/m5_oss_polish.md)
- Contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- Automation recipes: [examples/automations/README.md](examples/automations/README.md)

## License

This project is licensed under Apache-2.0. See [LICENSE](LICENSE).
