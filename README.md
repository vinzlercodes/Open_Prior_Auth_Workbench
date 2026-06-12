[![aislop](https://badges.scanaislop.com/score/vinzlercodes/Open_Prior_Auth_Workbench.svg)](https://scanaislop.com)

# Open Prior Auth Agent Workbench

Open Prior Auth Agent Workbench is a synthetic-data-only, provider-side prior authorization application built on the Doctor Agent OS substrate. The current runnable baseline covers M1-M8 plus M9 production-path documentation: local MRI lumbar spine and DME power wheelchair flows for requirement discovery, documentation capture, supporting information, PAS-style packet assembly, operations queueing, payer status handling, more-info loops, deterministic agent runs, approval gates, standards-shaped local gateway routes, and formal deterministic evals.

Doctor Agent OS is the implementation platform direction for reusable agent runtime, ToolNet tools, approvals, traces, and evaluations. MCP remains the next unimplemented interoperability boundary. Doctor Agent OS is not a broader committed business domain. The first and only committed app/domain is provider-side prior authorization.

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

## Current Baseline

- M1: synthetic launch/context, local requirement evaluation, and work item creation.
- M2: local DTR-inspired questionnaire workspace with deterministic prefill and validation.
- M3: deterministic PAS-style local packet build, mock submission, status timeline, and audit trail.
- M4: reusable prior-auth proof with MRI/Acme and DME/Blue Ridge scenarios sharing the same core, ToolNet, runtime, queue, packet, approval, and trace path.
- M5: Agent Cockpit where prior-auth case state is primary and deterministic agent trace is visible as a trust/debug layer.
- M6: SQLite-backed local persistence, transaction boundaries, DB scripts, and local standards-shaped adapter boundaries.
- M7: synthetic supporting information, DocumentReference/Binary-like packet entries, fixture DTR dependencies, standards-shaped non-conformant aliases, and SQLite evidence metadata.
- M8: deterministic Doctor Evals for golden traces, ToolNet policy, ApprovalGate behavior, prompt-injection-as-data checks, and safety claim checks.
- M9: production-path documentation for FHIR data plane, security/authz/audit, EHR/payer integration, deployment/observability, and conformance testing.

## Safety And Conformance Boundaries

This repository is synthetic-only, standards-shaped, non-certified, not PHI-ready, and not connected to live EHRs or payers. Do not use real PHI, payer credentials, production EHR URLs, or production payer endpoints.

It does not implement production SMART App Launch, CDS Hooks CRD, FHIR `$questionnaire-package`, Da Vinci DTR, Da Vinci PAS `$submit`, X12 278, payer endpoint discovery, production payer transport, payer adjudication, production-grade durable persistence, real FHIR persistence, or real EHR integration.

The `/dtr/*` endpoints are local DTR-like product endpoints. The `/pas/*` endpoints are PAS-style local product endpoints. The standards-shaped gateway routes and aliases return explicit non-conformance metadata and exist to mark replacement boundaries, not to claim SMART, CRD, DTR, or PAS compatibility.

## Repository Map

- `apps/api/`: TypeScript API for fixture-backed context lookup, requirement evaluation, questionnaire packages, packet building, mock submission, SQLite-backed local persistence, evidence, and operations APIs.
- `apps/web/`: Next.js workbench UI for the synthetic end-to-end demo.
- `packages/shared-types/`: Shared TypeScript contracts used by the API and web app.
- `packages/prior-auth-core/`: provider-side prior-auth Use Cases and ports.
- `packages/doctor-toolnet/`: agent/tool adapter over Prior Auth Core.
- `packages/doctor-runtime/`: workflow-agnostic run/task/tool/approval/trace runtime with SQLite persistence and generic tool-catalog interfaces.
- `packages/prior-auth-agent-team/`: deterministic prior-auth agent team and ToolNet bridge over the generic runtime.
- `packages/doctor-mcp/`: README-only placeholder for the planned MCP boundary over ToolNet.
- `packages/doctor-evals/`: deterministic regression and safety harness for local synthetic agent runs.
- `data/`: Synthetic FHIR bundles, golden scenarios, payer rule packs, questionnaires, evidence fixtures, and standards-shaped payload fixtures.
- `docs/`: Roadmap, glossary, architecture notes, conformance matrix, and demo story docs.
- `demo/`: Step-by-step demo guide and deterministic screenshot artifacts.
- `examples/automations/`: Docs-only automation recipes that call existing local APIs.
- `infra/compose/`: Lightweight compose notes for local API/web services.
- `tests/`: Contract tests for current M1-M8 behavior, standards-shaped gateway routes, package boundaries, runtime approvals, cockpit responses, and eval assertions.

Package direction is intentional: `apps/*` may import `packages/*`; `packages/*` must not import `apps/*`.

## API Surface

- `GET /health`
- `GET /context/patient/:id`
- `POST /requirements/evaluate`
- `POST /work-items`
- `GET /work-items?status=submitted,pended&owner=unassigned&sort=age_desc`
- `GET /work-items/:id`
- `GET /demo/scenarios`
- `POST /demo/seed-work-items`
- `POST /dtr/package`
- `POST /dtr/save-response`
- `POST /pas/build-packet`
- `POST /pas/submit`
- `GET /standards/boundaries`
- `GET /.well-known/smart-configuration`
- `GET /smart/launch`
- `POST /smart/token`
- `POST /crd/evaluate`
- `POST /dtr/questionnaire-package`
- `POST /dtr/evaluate-fixture-expression`
- `POST /pas/build-submission`
- `POST /pas/submit-local`
- `GET /work-items/:id/evidence`
- `POST /work-items/:id/evidence/attach-fixture`
- `POST /work-items/:id/evidence/upload`
- `POST /work-items/:id/evidence/:evidenceId/accept`
- `POST /work-items/:id/evidence/:evidenceId/remove`
- `GET /work-items/:id/status`
- `GET /work-items/:id/audit`
- `GET /work-items/:id/operations`
- `POST /work-items/:id/request-more-info`
- `POST /work-items/:id/record-payer-status`
- `GET /operations/metrics`
- `POST /demo/seed-work-items`

## Builder Docs

- Roadmap: [docs/roadmap.md](docs/roadmap.md)
- Glossary: [docs/glossary.md](docs/glossary.md)
- Doctor Agent OS architecture: [docs/architecture/doctor-agent-os.md](docs/architecture/doctor-agent-os.md)
- Prior Auth Core architecture: [docs/architecture/prior-auth-core.md](docs/architecture/prior-auth-core.md)
- ToolNet architecture: [docs/architecture/toolnet.md](docs/architecture/toolnet.md)
- Runtime architecture: [docs/architecture/runtime.md](docs/architecture/runtime.md)
- MCP architecture: [docs/architecture/mcp.md](docs/architecture/mcp.md)
- Strategy audit: [docs/architecture/strategy_report_implementation_audit.md](docs/architecture/strategy_report_implementation_audit.md)
- Conformance matrix: [docs/standards/conformance-matrix.md](docs/standards/conformance-matrix.md)
- Agentic story flow: [docs/demo/agentic-story-flow.md](docs/demo/agentic-story-flow.md)
- Demo walkthrough: [demo/README.md](demo/README.md)
- Screenshot guide: [demo/screenshots/README.md](demo/screenshots/README.md)
- Fixture index: [data/README.md](data/README.md)
- Contributor guide: [CONTRIBUTING.md](CONTRIBUTING.md)
- Security reporting: [SECURITY.md](SECURITY.md)
- Automation recipes: [examples/automations/README.md](examples/automations/README.md)

## License

This project is licensed under Apache-2.0. See [LICENSE](LICENSE).
