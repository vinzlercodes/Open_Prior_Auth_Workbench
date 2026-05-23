# Strategy Report Implementation Audit

Audit target: `open_prior_auth_workbench_strategy_report.pdf`

Audit date: April 29, 2026

Audit round: fourth full audit pass, superseding the April 28, 2026 M7-centered audit where implementation status or project language has changed.

Fourth-round verification: an initial sandboxed `npm test` rebuilt successfully but failed only because route tests could not bind `127.0.0.1`. The rerun with localhost permission passed 51/51 tests. `npm run typecheck` passed. `npm run build` passed. Node emitted expected experimental `node:sqlite` warnings during SQLite tests.

## Audit Basis

This audit re-read the 14-page strategy report from `open_prior_auth_workbench_strategy_report.pdf`, re-extracted 696 lines of text, and rendered 14 PNG pages under `tmp/pdfs/` for spot visual inspection before removing the temporary files. It also read `CONTEXT.md` and `tasks/lessons.md` before updating conclusions, because the project now has explicit domain-language decisions that affect how implementation status should be described.

Important domain-language adjustments from `CONTEXT.md`:

- The internal lifecycle is a **Prior Authorization Case**.
- A **Work Item** is an operations-layer queue or task representation of a Prior Authorization Case.
- A payer-facing artifact is a **Prior Authorization Request**.
- A built payload is a **Submission Packet**.
- Provider-side pre-submission gaps are **Baseline Information Gaps**.
- Payer-side follow-up is an **Additional Information Request** with one or more **Requested Information Items**.
- The umbrella term is **Supporting Information**. Document-like support is **Supporting Documentation**. A payer-exchange representation is an **Attachment**.
- A local rules JSON file is a **Rule Pack**, not the Prior Authorization Policy itself.
- Local pre-submission analysis is a **Requirement Evaluation**, not a payer determination.
- Pended is a **Payer Status Update**, not a terminal **Payer Determination**.

Important lessons from `tasks/lessons.md`:

- Keep internal workbench status separate from external payer status.
- Timestamp-dependent metrics need first-class timestamps.
- Do not promote packet or transport bookkeeping into canonical business terms too early.
- Avoid overloaded healthcare terms when FHIR already uses them differently.
- Avoid using "determination" for pre-submission workbench outputs.

The audit below intentionally uses those terms, even when the current code still uses implementation names such as `workItem`, `evidence`, `packet`, or `status`.

## Executive Finding

The project remains a strong local, synthetic, provider-side prior authorization workbench for one MRI lumbar spine scenario. It implements a deterministic local path from fixture-backed clinical context through Requirement Evaluation, Work Item creation, local questionnaire capture, Supporting Information attachment, Submission Packet build, mock PAS-style submission, queue operations, payer status updates, Additional Information Request simulation, audit events, and SQLite-backed persistence.

The strongest runnable path today is still the M7 path:

1. Load synthetic patient, coverage, order, encounter, practitioner, organization, condition, and observation context.
2. Run a deterministic local Requirement Evaluation against one Acme Health MRI lumbar spine Rule Pack.
3. Create a durable Work Item as the operations view of the Prior Authorization Case.
4. Open a DTR-inspired questionnaire workspace with deterministic prefill and fixture dependencies.
5. Attach or upload synthetic Supporting Information.
6. Accept or remove that Supporting Information before Submission Packet build.
7. Validate and mark the QuestionnaireResponse review-ready.
8. Build an M7 local PAS-style Submission Packet with accepted Attachments in the manifest and Bundle.
9. Submit through mock PAS transport.
10. Track queue state, payer-pended state, Additional Information Requests, denial reasons, terminal outcomes, metrics, status events, operation events, audit snapshots, packets, receipts, and evidence metadata in SQLite.

Since the prior audit, the repository has acquired standards-harness groundwork: `data/standards/` fixture payloads and shared types for SMART discovery metadata, CDS Hooks requests/responses, FHIR Parameters, and CDS Hooks primary hook names. However, the current API source does **not** expose the full M8 standards conformance fixture harness described in `tasks/todo.md` and in the old audit tail. There are no current source routes for CDS Hooks discovery or invocation, no source route for a FHIR-base `Questionnaire/$questionnaire-package`, and no source route for PAS `Claim/$submit`. The implemented standards surface remains the M7 local, explicitly non-conformant alias surface.

That means the project has progressed beyond the third audit in two ways:

- It has clearer domain language and new standards fixture/type groundwork.
- It has also developed documentation/task drift that must be corrected before claiming M8 route-level implementation.

The project still does not implement the production architecture recommended by the report: production SMART App Launch, CDS Hooks CRD, Da Vinci DTR conformance, Da Vinci PAS `$submit`, X12 278 transport, payer endpoint discovery, real payer integrations, Medplum-backed FHIR persistence, HAPI compatibility target, Temporal workflows, Keycloak, OpenFGA, Presidio, OpenTelemetry, Langfuse, n8n runtime integrations, OCR, parser pipelines, AI evidence extraction, real PHI workflows, or multi-service-line coverage.

## What Changed Since The Third Audit

Implemented or present since the M7-centered third audit:

- `CONTEXT.md` now defines a domain vocabulary for Prior Authorization Case, Work Item, Prior Authorization Request, Submission Packet, Supporting Information, Attachment, Additional Information Request, Requested Information Item, Baseline Information Gap, Prior Authorization Policy, Rule Pack, Requirement Evaluation, Payer Status Update, Payer Determination, Documentation Workspace, and Questionnaire Session.
- `tasks/lessons.md` now contains lessons that warn against status conflation, timestamp inference, transport-term leakage, overloaded healthcare terminology, and misuse of "determination".
- `data/standards/` contains standards fixture payloads:
  - `smart-discovery.local.json`
  - `crd-appointment-book.request.json`
  - `crd-order-dispatch.request.json`
  - `crd-order-sign.request.json`
  - `dtr-questionnaire-package.parameters.json`
  - `pas-claim-submit.bundle.json`
- `packages/shared-types/src/index.ts` contains shared types for:
  - `FhirParameters`
  - `SmartDiscoveryMetadata`
  - `CdsHooksPrimaryHook`
  - `CdsServiceDescriptor`
  - `CdsServicesResponse`
  - `CdsHooksRequest`
  - `CdsHooksResponse`
- `tasks/todo.md` records an M8 Standards Conformance Fixture Harness milestone with claimed test, typecheck, and build success.
- The old audit file had an appended M8 implementation update.

Not actually present in current source, despite those task/audit claims:

- No `docs/architecture/m8_*.md` file exists.
- `README.md` still lists milestones only through M7 and says tests cover M1-M6 in one repository-map line.
- `data/README.md` does not list the `data/standards/` fixtures.
- `demo/README.md` still says the demo scope is M1-M7 and has no M8 standards harness walkthrough.
- `apps/api/src/server.ts` does not expose `/cds-services`.
- `apps/api/src/server.ts` does not expose `/cds-services/:serviceId`.
- `apps/api/src/server.ts` does not expose a FHIR-base `Questionnaire/$questionnaire-package` route.
- `apps/api/src/server.ts` does not expose `Claim/$submit`.
- `apps/api/src/adapters/localStandardsAdapters.ts` still returns M7 contract versions and M7-style explicit non-conformance.
- No dedicated standards conformance test file exists under `tests/`; current tests remain the seven M1-M7 contract files.

Audit conclusion changed:

- The M7 Supporting Information and Attachment path remains implemented locally.
- M8 is not route-complete in the current source. It is fixture/type groundwork plus documentation drift, not a finished standards conformance harness.
- The next practical task is either to finish M8 honestly or to revise the milestone notes/docs to say M8 is only partially complete.

## Current Evidence Inventory

### Runnable Product Surface

The repository currently contains:

- `apps/api/`: Node HTTP API for fixture-backed context lookup, Requirement Evaluation, Work Item lifecycle, DTR-inspired questionnaire package, evidence lifecycle, Submission Packet build, mock submission, SQLite persistence, operations queue, payer updates, Additional Information Request loop, metrics, status events, operation events, and audit events.
- `apps/web/`: Next.js workbench UI for the synthetic end-to-end demo, including queue operations and evidence controls.
- `packages/shared-types/`: Shared TypeScript contracts for requirement evaluation, work items, questionnaires, DTR-shaped aliases, packets, evidence, operations, status events, audit events, and partial M8 standards fixture types.
- `data/`: Synthetic FHIR bundles, golden scenarios, missing-evidence scenario, Rule Pack, questionnaire fixture, DTR dependency fixture, Supporting Information fixtures, and standards fixture payloads.
- `tests/`: Seven contract test files covering current M1-M7 behavior.
- `docs/architecture/`: Architecture notes from M1 through M7 plus this audit.
- `demo/`: Demo guide and seven screenshot artifacts for the workbench flow.
- `.github/workflows/ci.yml`: Node `22.18.x` and `24.2.x` CI matrix.
- `examples/automations/`: Docs-only automation recipes.
- `infra/compose/`: Lightweight compose notes.

### Implemented Scenario

The implemented clinical and payer scenario is intentionally narrow:

- Service line: `mri_lumbar_spine`.
- Payer: `acme-health`.
- Patient: `patient-mri-001`.
- Coverage: `coverage-acme-001`.
- Ordered service: `ServiceRequest/servicerequest-mri-lumbar-001`.
- Golden evaluation: `eval-8a673eae6c28942c`.
- Fresh-process golden Work Item: `wi-8a673eae6c28`.
- Rule Pack: `data/payer-rules/mri-lumbar-spine.acme-health.v1.json`.
- Questionnaire: `data/questionnaires/mri-lumbar-spine-prior-auth.2026.04.json`.
- DTR dependencies: `data/questionnaires/mri-lumbar-spine-prior-auth.dependencies.json`.
- Supporting Information fixtures: `fixture-pt-summary-inline`, `fixture-mri-note-binary`, `fixture-synthetic-pdf-binary`, and `fixture-bundle-smoke`.
- Standards fixture payloads: present under `data/standards`, but not wired into full API routes.

## Report Section Audit

### 1. Executive Summary

Report intent: build a provider-side prior-auth workbench with TypeScript product edge, FHIR-native platform, durable workflow engine, Python document/AI service, form renderer abstraction, security layer, observability, and integration sidecar.

Implemented:

- TypeScript API and Next.js web app.
- Synthetic-data-first local sandbox.
- Requirement Evaluation for one Rule Pack.
- Local questionnaire capture and validation.
- Local DTR dependency fixtures.
- Manual Supporting Information attach, upload, accept, and remove workflow.
- M7 local PAS-style Submission Packet assembly with Attachment manifest.
- Mock submission and ClaimResponse-like receipt.
- Operations queue, metrics, status events, operation events, audit events.
- SQLite-backed local persistence with explicit transactions.
- M7 standards-shaped local aliases with explicit non-conformance metadata.
- Partial standards fixture/type groundwork under `data/standards` and shared types.

Partially implemented:

- FHIR-shaped resources exist in fixtures, QuestionnaireResponses, DocumentReference/Binary-like packet entries, Claim-like packets, and ClaimResponse-like receipts, but there is no FHIR server.
- Durable state exists in SQLite, but there is no Temporal workflow engine.
- DTR/PAS vocabulary is present in local endpoints, but current route behavior is not Da Vinci conformant.
- Supporting Information attachments exist locally, but not as production claims-attachment transactions.

Not implemented:

- Production SMART App Launch.
- Medplum.
- HAPI FHIR compatibility target.
- Temporal.
- Python/FastAPI document or AI service.
- Docling, Marker, OCRmyPDF, Unstructured.
- Presidio.
- Langfuse.
- OpenTelemetry.
- OpenFGA.
- Keycloak.
- Runtime n8n integration.
- Real CRD/DTR/PAS/X12 behavior.

Remaining:

- Decide whether M8 should finish standards route implementation or whether docs should be corrected to represent it as fixture groundwork only.
- Add a real standards conformance track only when there are runnable endpoints and tests, not just fixture files.

### 2. Problem Framing And Market Context

Report intent: justify prior authorization as a high-burden, regulation-driven, standards-aligned wedge and frame claims attachments as a natural phase-two expansion.

Implemented:

- The product remains centered on prior authorization administrative burden, not clinical decision-making.
- The implemented flow shows staff-facing operations work, documentation capture, and packet preparation.
- Supporting Information attachments make the local workflow closer to real authorization packet work than earlier audits.

Partially implemented:

- Claims-attachment direction is represented by synthetic Supporting Information fixtures and local packet manifests.
- Denial and Additional Information Request handling exists only as mock-payer local behavior.

Not implemented:

- CMS operational reporting.
- Payer API compliance.
- HHS claims-attachment transaction compliance.
- Production provider deployment.
- Real payer policy ingestion.

Remaining:

- Keep phase two attachment work grounded in the local case engine, but avoid claiming transaction compliance until transport and standards semantics are real.

### 3. Product Recommendation And Scope

Report intent: create an open-source provider-side workbench for requirement discovery, documentation capture, packet assembly, lifecycle tracking, and later claims attachments.

Implemented:

- Requirement Evaluation for one payer/service-line Rule Pack.
- Questionnaire package retrieval for one fixture.
- Deterministic prefill from local FHIR fixtures.
- Local Library and ValueSet dependencies.
- Review-ready state.
- Supporting Information attach/upload/accept/remove workflow.
- PAS-style local Submission Packet builder with Attachment manifest.
- Mock submission and local receipt.
- Queue, metrics, status events, operation events, audit events.
- SQLite durability.
- Open-source posture and builder docs.

Partially implemented:

- The workbench is locally durable but not enterprise deployable.
- Packet payloads are local FHIR-shaped Bundles, not Da Vinci PAS/X12 payloads.
- Standards aliases are boundary markers, not compatible standards endpoints.
- `data/standards` now provides future standards-harness inputs, but the API does not yet serve the full harness.

Not implemented:

- Multiple payers.
- Multiple service lines.
- Real payer-specific connectors.
- Claims-attachment transaction support.
- Denial analytics beyond basic rates and structured reason capture.
- Extension SDKs.

Remaining:

- Add a second service line or second payer only after the standards/docs drift is resolved.
- Separate local product endpoints from standards endpoints in the API documentation.

### 4. PRD

#### 4.1 Product Vision

Implemented:

- The local workbench turns payer requirements, forms, fixture context, Supporting Information, packet data, status events, and audit events into a traceable workflow.
- The workflow runs locally with synthetic data.
- SQLite persists workbench state and Supporting Information metadata across restarts.

Partially implemented:

- The workbench is "standards-aligned" in vocabulary and resource shape, not in conformance.
- It can run beside an EHR conceptually, but not inside a real EHR.

Not implemented:

- Real EHR launch.
- Real payer systems.
- Real PHI processing.
- Real payer Prior Authorization Policy management.

#### 4.2 Users And Personas

Ordering clinician:

- Implemented locally through launch shim and Requirement Evaluation.
- Not implemented as real SMART launch, EHR embedded workflow, clinician identity, or EHR context propagation.

Authorization specialist:

- Implemented locally through Work Item, Documentation Workspace-like form area, validation, mark-ready flow, Supporting Information controls, packet builder, and Additional Information Request resolution.
- Missing real document review, role-specific assignment, collaboration, comments, production form renderer, and real user permissions.

Operations lead:

- Implemented locally through queue, filters, aging, pended effective status, denial state, terminal outcomes, operation history, and metrics.
- Missing enterprise dashboards, SLAs, public reporting exports, team analytics, and payer-specific performance reporting.

Developer / implementation partner:

- Implemented through local setup, fixtures, tests, scripts, architecture notes, standards-boundary aliases, CI, and standards fixture files.
- Missing runnable conformance harnesses, extension SDKs, real FHIR server targets, and clean M8 documentation.

#### 4.3 Jobs To Be Done

Implemented locally:

- "Does this require prior auth?" through deterministic Requirement Evaluation.
- "What documentation is needed?" through Rule Pack output, questionnaire canonical, missing baseline data, and Supporting Information fixture options.
- "What is missing?" through baseline missing data and questionnaire validation.
- "Review, submit, track without losing audit trail" through review-ready status, packet build, mock submit, status events, operation events, and audit events.
- "Payer requests more information or denies" through mock Additional Information Request and denial reason flow.

Not implemented:

- Real payer-specific documentation discovery.
- Real payer Additional Information Requests.
- Real payer denials or appeal analytics.
- Automated document evidence mapping.

#### 4.4 MVP User Stories

Story 1: Clinician can launch from patient/order context and see whether prior auth is required.

- Status: partially implemented.
- Evidence: `GET /smart/launch`, `GET /context/patient/:id`, `POST /requirements/evaluate`.
- Gap: local shim only; no SMART OAuth or EHR launch.

Story 2: Authorization specialist can open a Work Item and receive payer-specific questionnaire package with prefill.

- Status: implemented locally.
- Evidence: `POST /dtr/package`, `QuestionnaireService`, local prefill, session revision, validation, fixture dependencies.
- Gap: no production DTR operation, no form renderer adapter, no real payer package retrieval.

Story 3: Authorization specialist can validate, save, and mark a packet ready for review.

- Status: implemented locally.
- Evidence: `POST /dtr/save-response`, validation, stale revision conflict, `review_ready`.
- Gap: no role-based review approval or multi-user collaboration.

Story 4: Operations lead can see all Work Items and identify cases stuck in Additional Information Request or aging queues.

- Status: implemented locally.
- Evidence: `GET /work-items`, queue filters, aging, effective `pended` status, `GET /operations/metrics`.
- Gap: not enterprise reporting or CMS reporting.

Story 5: Developer can run locally with synthetic patients, example rules, and conformance fixtures.

- Status: partially implemented.
- Evidence: synthetic data, tests, local scripts, `data/standards` fixture files.
- Gap: standards fixtures are not yet a complete runnable conformance harness in API source.

#### 4.5 Scope

v0.1 report scope:

- SMART launch: partially implemented as local shim only.
- Requirement discovery: implemented locally.
- Questionnaire package retrieval: implemented locally, DTR-inspired.
- Prefill: implemented deterministically from fixtures.
- Review: implemented as mark-ready local state.
- Packet builder: implemented locally.
- Mock submission: implemented locally.
- Status dashboard: implemented locally in API and web UI.

v0.2 report scope:

- More payer Rule Packs: not implemented.
- More service lines: not implemented.
- Additional Information Request loop: implemented locally.
- Denial reasons: implemented locally.
- Attachment manifest: implemented locally in M7.
- Optional n8n connectors: docs-only examples exist; runtime connectors not implemented.

Future report scope:

- Claims attachments: not implemented as real transaction; local Supporting Information Attachments exist.
- Denial analytics: only basic local metrics.
- Payer-specific adapters: not implemented.
- Enterprise audit controls: audit log exists locally; enterprise controls not implemented.
- Customer-specific automations: docs-only examples only.

#### 4.6 Non-Goals

Implemented as guardrails:

- The project does not automate final payer adjudication.
- It does not replace the EHR.
- It does not market itself as a clinical AI decision-maker.
- It does not make n8n or an agent framework the canonical workflow engine.
- It uses synthetic data.

Remaining:

- Keep those boundaries prominent as standards and Supporting Information features become more realistic.

#### 4.7 Success Metrics

Implemented:

- Prefill count and provenance are available in the questionnaire package.
- Completion percent and validation issues are available.
- Time-to-review-ready and decision timing metrics are locally computable.
- Missing baseline data is explicit in Requirement Evaluation.
- Mock submission success and packet reproducibility are tested.

Partially implemented:

- Human touches are approximated through operation and audit events, but not formalized as a metric.
- Denial, approval, more-info, and pended rates exist in local operations metrics.

Not implemented:

- Conformance pass rate against Inferno, SMART launch flows, and Da Vinci fixtures.
- Production SLA metrics.
- CMS public reporting output.

Remaining:

- If M8 continues, add an actual standards-harness pass/fail result model instead of only fixture payload files.

### 5. End-To-End Workflow Design

#### 5.1 Requirement Discovery

Implemented:

- Local patient/order context resolution.
- Requirement Evaluation against Rule Pack.
- Structured result with prior-auth requirement, documentation requirement, questionnaire canonical, missing baseline data, next action, and explanatory notes.
- Work Item creation after Requirement Evaluation.

Partially implemented:

- SMART and CRD are represented as local aliases and fixture semantics.
- Shared types now include CDS Hooks request/response concepts, but current API source does not expose CDS Hooks CRD routes.

Not implemented:

- Production SMART launch.
- CDS Hooks CRD request/response semantics.
- Payer endpoint discovery.
- Multiple hooks wired into routes.

#### 5.2 Documentation And Questionnaire Capture

Implemented:

- Authorization specialist can open a Work Item.
- `QuestionnaireService` returns Questionnaire, draft QuestionnaireResponse, dependencies, prefill, validation, completion, and session summary.
- Local DTR dependencies include Library and ValueSet fixtures.
- Fixture expression evaluation is allowlisted.
- Specialist can edit fields, save drafts, and mark review-ready.
- Supporting Information can be attached or uploaded.

Partially implemented:

- DTR package is Parameters-shaped for the M7 alias, but not a conformant Da Vinci DTR `$questionnaire-package`.
- The web UI is custom React, not Refero, Smart Forms, or LForms.

Not implemented:

- Real DTR package retrieval.
- CQL execution engine.
- Full SDC behavior.
- Production document management.
- OCR or parser-based evidence extraction.

#### 5.3 Review And Submission Packaging

Implemented:

- Reviewer can inspect packet-related state in the UI.
- Submission service builds deterministic local Submission Packets.
- Packet includes patient, coverage, encounter, practitioner, organization, request, conditions, observations, QuestionnaireResponse, accepted DocumentReference/Binary-like Attachment resources, and Claim-like resource.
- Attachment manifest includes accepted Supporting Information.
- Packet snapshot includes QuestionnaireResponse revision and evidence digest.
- Mock transport records receipt and external tracking ID.
- Status and audit events are recorded.

Partially implemented:

- Current packet is PAS-style and local, not Da Vinci PAS/X12.
- `data/standards/pas-claim-submit.bundle.json` exists as a fixture but is not used by a `Claim/$submit` API route.

Not implemented:

- Da Vinci PAS `$submit`.
- X12 278.
- PAS inquiry/status.
- Payer authentication.
- Endpoint discovery.
- Real transport receipts.

#### 5.4 Status, Denials, And Additional Information Request Loop

Implemented:

- Submitted Work Items can receive local Payer Status Updates: pended, approved, denied, cancelled.
- Pended remains an effective operations status rather than being stored as a terminal internal status.
- Denial reasons are structured.
- Additional Information Requests can be created with Requested Information Items and due dates.
- Saving a review-ready response from more-info-needed resolves open Additional Information Request state.
- Operations history and metrics include payer updates and Additional Information Request events.

Partially implemented:

- This is local mock-payer behavior, not payer API behavior.
- The domain language in `CONTEXT.md` is clearer than some code names, which still use `MoreInfoRequest`.

Not implemented:

- Real payer notifications.
- PAS inquiry.
- Appeals.
- Resubmission modeling as a distinct Submission Packet on an existing Prior Authorization Request.
- CMS reporting.

#### 5.5 Optional Integration Automations

Implemented:

- Docs-only automation examples exist under `examples/automations`.

Not implemented:

- Runtime n8n sidecar.
- Slack/email/helpdesk connectors.
- Event webhooks.
- Customer-specific handoffs.

Remaining:

- Keep n8n outside canonical case state if runtime integrations are added.

### 6. Reference Architecture

#### 6.1 Architecture Principles

FHIR-native:

- Partially implemented through FHIR-shaped fixtures and payloads.
- No FHIR server or canonical FHIR persistence.

Workflow state outside FHIR:

- Implemented locally through SQLite tables and app-owned store interfaces.
- No Temporal workflow history.

Durable orchestration:

- Partially implemented through SQLite transactions and restart survival.
- Temporal is not implemented.

Human-in-the-loop:

- Implemented locally for questionnaire review, Supporting Information acceptance, and packet build.
- AI suggestions are not implemented.

Synthetic-first:

- Implemented strongly.

Replaceable subsystems:

- Partially implemented through `PriorAuthStore`, `MemoryStore`, `SqliteStore`, and local standards adapter classes.
- Form renderer, parser, vector store, FHIR substrate, and auth adapters are not real replaceable subsystems yet.

#### 6.2 Logical Architecture

Implemented:

- Web app.
- API gateway/application API.
- Requirement engine.
- Questionnaire service.
- Submission service.
- Local operations/status behavior.
- SQLite store.

Partially implemented:

- Standards/test harness groundwork through fixtures and shared types.
- Local standards adapter boundary classes.

Not implemented:

- AI/document service.
- n8n runtime sidecar.
- Temporal workers.
- Medplum.
- HAPI.
- External standards/test harness integrations.
- Vector retrieval.
- Authz.
- Observability stack.
- Document stores.

#### 6.3 Service Boundaries

Web app:

- Implemented as a single local demo UI.
- Missing SMART client JS and production app shell.

API gateway:

- Implemented as a Node HTTP API.
- Missing route-level auth, API versioning, generated OpenAPI docs, and production middleware.

Requirement engine:

- Implemented as deterministic local evaluator.
- Missing FHIRPath, multi-payer policy resolution, and production Prior Authorization Policy source.

Questionnaire service:

- Implemented locally with prefill, validation, sessions, dependencies, and fixture expression evaluation.
- Missing renderer abstraction and real DTR/SDC behavior.

Submission service:

- Implemented locally with deterministic packet build and mock submission.
- Missing real PAS/X12 transport.

Status service:

- Implemented mostly through store and operations service.
- Missing separate service boundary and payer status API integrations.

AI/document service:

- Not implemented.

Temporal workers:

- Not implemented.

FHIR platform:

- Not implemented.

#### 6.4 Security And Trust Boundaries

Implemented:

- Synthetic-only guidance.
- Audit events for local changes.
- Explicit non-conformance metadata on standards-shaped aliases.

Partially implemented:

- Local actor strings appear in audit and operations events.
- There is no real identity, token validation, or authorization.

Not implemented:

- SMART/OAuth identity.
- Keycloak.
- OpenFGA.
- Case- or org-level authorization.
- Presidio redaction.
- Minimum-necessary prompt controls.
- Real PHI handling controls.
- Secrets management.

Remaining:

- Add auth only after the domain model distinguishes Prior Authorization Case permissions from Work Item assignment and payer-facing request permissions.

### 7. Detailed Technical Stack

#### 7.1 Frontend And App Shell

Implemented:

- Next.js, React, and TypeScript app exists.
- It supports the local synthetic workbench flow.

Not implemented:

- SMART client JS.
- Real launch and token exchange adapter.
- Production EHR embedding.

#### 7.2 Medplum

Not implemented:

- No Medplum server, SDK integration, Bots, Subscriptions, or Medplum auth.

Current substitute:

- `FixtureFhirRepository` loads local synthetic bundles from disk.

#### 7.3 HAPI

Not implemented:

- No HAPI FHIR JPA starter, Docker target, compatibility tests, or FHIR server abstraction.

#### 7.4 Temporal

Not implemented:

- No Temporal workers, workflows, activities, retries, timers, or durable workflow history.

Current substitute:

- SQLite persists local case state and transaction boundaries.

#### 7.5 n8n

Implemented:

- Docs-only automation recipes.

Not implemented:

- No n8n runtime, queue mode, binary data handling, or connector execution.

#### 7.6 Questionnaire Rendering

Implemented:

- Custom React form workspace for the local questionnaire.
- Local validation and deterministic prefill.

Not implemented:

- Refero.
- Smart Forms.
- LForms.
- Renderer adapter.
- Full SDC renderer behavior.

#### 7.7 Document Intelligence Stack

Implemented:

- Manual local text/base64 upload.
- Synthetic DocumentReference/Binary-like packet entries.
- Evidence digest and manifest.

Not implemented:

- Docling.
- Marker.
- OCRmyPDF.
- Unstructured.
- Parser confidence.
- OCR needed/not-needed metadata.
- Human acceptance of extracted evidence from parsed documents.

#### 7.8 AI Layer Design

Not implemented:

- No AI service.
- No document classification.
- No candidate evidence extraction.
- No denial summarization.
- No missing-evidence mapping.
- No LangGraph bounded AI subflows.

Current guardrail:

- The app remains deterministic and synthetic.

#### 7.9 Authorization And Security Stack

Not implemented:

- Keycloak.
- OpenFGA.
- Relationship-based authorization model.
- Real users, organizations, roles, scopes, or consent.

Current substitute:

- Actor IDs are string metadata in local events.

#### 7.10 Observability And Evals

Implemented:

- Local status, operation, and audit event history.
- Contract tests.

Not implemented:

- OpenTelemetry traces.
- Langfuse traces.
- Prompt datasets.
- AI evals.
- Conformance pass-rate dashboard.

### 8. Open-Source Integration Matrix

HL7 Da Vinci CRD:

- Partially represented by local CRD-inspired route and new CDS Hooks fixture files.
- Not implemented as CDS Hooks CRD.

HL7 Da Vinci DTR:

- Partially represented by local DTR-inspired package and Parameters-shaped alias.
- Not implemented as Da Vinci DTR.

HL7 Da Vinci PAS:

- Partially represented by local PAS-style packet and mock transport.
- Not implemented as Da Vinci PAS.

CDS Hooks Sandbox:

- Not integrated.

Inferno:

- Not integrated.

Synthea:

- Synthetic data exists, but no Synthea generation pipeline is checked in.

Medplum:

- Not integrated.

HAPI:

- Not integrated.

Refero / Smart Forms / LForms:

- Not integrated.

Docling / Marker / Unstructured:

- Not integrated.

Presidio:

- Not integrated.

Langfuse:

- Not integrated.

OpenFGA:

- Not integrated.

n8n:

- Docs-only examples, no runtime integration.

### 9. Core Data Model And API Shape

#### 9.1 Canonical FHIR Resources

Implemented as fixtures or packet resources:

- Patient.
- Coverage.
- Encounter.
- Practitioner.
- Organization.
- ServiceRequest.
- Questionnaire.
- QuestionnaireResponse.
- DocumentReference-like resources.
- Binary-like resources.
- Claim-like packet resource.
- ClaimResponse-like receipt resource.

Not implemented or not canonical:

- MedicationRequest and DeviceRequest scenarios.
- Task as a durable FHIR resource.
- Provenance as a FHIR resource.
- AuditEvent as a FHIR resource.
- Real FHIR persistence.

#### 9.2 App-Owned Operational Tables

Implemented in SQLite:

- `requirement_runs`.
- `work_items`.
- `questionnaire_sessions`.
- `submission_packets`.
- `submission_receipts`.
- `status_events`.
- `payer_updates`.
- `more_info_requests`.
- `operation_events`.
- `audit_events`.
- `evidence_attachments`.
- `schema_migrations`.

Important deviations from report table names:

- `audit_log` is implemented as `audit_events`.
- Additional Information Requests are stored as `more_info_requests` in code, but the domain term should be Additional Information Request.
- Supporting Information is stored as `evidence_attachments` in code, but the domain audit should treat this as Supporting Information metadata and Attachment lifecycle state.

Implemented schema quality:

- STRICT tables.
- Foreign keys.
- CHECK constraints.
- JSON validity checks.
- Unique constraints for deterministic packet snapshots.
- Explicit transactions.
- Schema version 2 migration for Supporting Information/Attachment metadata.

Not implemented:

- Production PostgreSQL.
- Multi-tenant data model.
- Case-level authorization tables.
- FHIR server storage.
- Temporal workflow tables.

#### 9.3 Product-Facing Endpoints

Report-listed endpoints and status:

- `GET /smart/launch`: implemented as local shim.
- `GET /context/patient/:id`: implemented.
- `POST /crd/evaluate`: implemented as local non-conformant alias.
- `POST /dtr/package`: implemented.
- `POST /dtr/save-response`: implemented.
- `POST /pas/build-packet`: implemented.
- `POST /pas/submit`: implemented as mock PAS.
- `GET /work-items/:id`: implemented.
- `GET /work-items/:id/status`: implemented.
- `POST /work-items/:id/request-more-info`: implemented, but should be described as Additional Information Request in domain docs.

Additional implemented endpoints:

- `GET /health`.
- `POST /requirements/evaluate`.
- `POST /work-items`.
- `GET /work-items`.
- `GET /operations/metrics`.
- `GET /standards/boundaries`.
- `GET /.well-known/smart-configuration`.
- `POST /smart/token`.
- `POST /dtr/questionnaire-package`.
- `POST /dtr/evaluate-fixture-expression`.
- `POST /pas/build-submission`.
- `POST /pas/submit-local`.
- `GET /work-items/:id/evidence`.
- `POST /work-items/:id/evidence/attach-fixture`.
- `POST /work-items/:id/evidence/upload`.
- `POST /work-items/:id/evidence/:evidenceId/accept`.
- `POST /work-items/:id/evidence/:evidenceId/remove`.
- `GET /work-items/:id/audit`.
- `GET /work-items/:id/operations`.
- `POST /work-items/:id/record-payer-status`.
- `POST /demo/seed-work-items`.

M8-claimed but not currently implemented endpoints:

- `GET /cds-services`.
- `POST /cds-services/:serviceId`.
- FHIR-base `Questionnaire/$questionnaire-package`.
- FHIR-base `Claim/$submit`.
- A separate FHIR-base SMART discovery endpoint beyond the existing `/.well-known/smart-configuration`.

### 10. Repository Structure

Implemented:

- `apps/web`.
- `apps/api`.
- `packages/shared-types`.
- `data/seed`.
- `data/payer-rules`.
- `data/questionnaires`.
- `data/evidence`.
- `data/standards`.
- `infra/compose`.
- `tests`.
- `docs/architecture`.
- `examples/automations`.
- `demo`.

Not implemented:

- `workers/temporal`.
- `services/ai-docs`.
- `packages/fhir-models`.
- `packages/rules-sdk`.
- `packages/questionnaire-adapter`.
- `packages/validation`.
- `infra/k8s`.
- `infra/observability`.
- `tests/contract`, `tests/integration`, `tests/e2e`, `tests/fixtures` substructure.
- `docs/workflows`.
- `docs/adr`.
- `docs/api`.
- `examples/mri-lumbar-spine`, `examples/home-oxygen`, `examples/specialty-infusion`.

Assessment:

- The repository is no longer document-first only, but `AGENTS.md` is stale on that point.
- The implemented structure is simpler than the report recommendation and appropriate for a local sandbox.
- The docs need a pass to reflect M7 and partial-M8 reality.

### 11. Roadmap And Delivery Plan

M1 Standards sandbox:

- Implemented locally.
- Not implemented as real SMART/CRD/Medplum/HAPI/Synthea pipeline.

M2 Form workspace:

- Implemented locally.
- Not implemented with real DTR, renderer adapter, or production form engine.

M3 Packet builder:

- Implemented locally.
- Not implemented as real PAS/X12.

M4 Operations layer:

- Implemented locally, including queue, aging, Additional Information Request loop, denial reasons, and metrics.

M5 OSS polish:

- Mostly implemented with docs, CI, screenshots, fixture index, and automation recipes.
- Now stale in places because README and demo docs do not fully reflect M7 and partial M8.

M6 Durable standards boundary:

- Implemented locally with SQLite, `PriorAuthStore`, transactions, scripts, and local standards adapter boundaries.

M7 Evidence and DTR boundary:

- Implemented locally with Supporting Information attachments, DocumentReference/Binary-like entries, DTR dependencies, evidence lifecycle routes, and packet manifests.

M8 Standards conformance fixture harness:

- Partially present as fixtures and shared types.
- Not implemented as full API route harness in current source.
- Documentation and task notes overstate completion.

### 12. Risks And Mitigation Plan

SMART/EHR auth variability:

- Still open. Local shim and non-conformant SMART metadata exist, but no real OAuth.

FHIR data incompleteness:

- Partially mitigated through missing baseline data and prefill provenance.
- No confidence scoring beyond deterministic prefill.

Questionnaire renderer edge cases:

- Still open. Custom form workspace exists, but no renderer abstraction or SDC engine.

Document parsing variability:

- Still open. Manual upload exists, but no parser or extraction confidence.

Overusing n8n or agents:

- Mitigated by not using n8n for canonical state.

Auth model complexity:

- Still open. No identity or authorization stack.

Scope creep:

- Mixed. The local flow remains narrow, but M8 task/docs drift shows a risk of claiming more standards conformance than is implemented.

Additional current risk:

- Domain/code language drift. `CONTEXT.md` now defines better terms than some current implementation names. This is acceptable in code for now, but docs and audits should use the canonical domain language so future refactors are intentional.

### 13. Public Forum And Developer Field Notes

Implemented response to field-note realism:

- The project keeps local setup simple.
- It avoids real PHI.
- It avoids making n8n the state engine.
- It labels local standards aliases as non-conformant.

Not implemented:

- HAPI local Docker.
- SMART auth integration.
- Keycloak/OpenFGA split.
- Langfuse or Phoenix-style AI observability.
- n8n runtime hardening.

Current assessment:

- The project follows the report's pragmatic advice by staying synthetic-first and local. The main correction needed is to avoid overclaiming M8 standards harness completion.

### 14. Final Recommendation

Report recommendation: build a standards-aligned, provider-side workflow product with FHIR-native data plane, Temporal-owned case lifecycle, TypeScript-first product layer, Python-only AI/document sidecar, renderer abstraction, and n8n only for edge integrations.

Implemented today:

- Standards-aligned vocabulary and shapes.
- TypeScript product/API layer.
- Local synthetic Prior Authorization Case workflow.
- SQLite local durability.
- Local Supporting Information attachment path.
- Operations queue and metrics.

Not implemented today:

- FHIR-native data plane.
- Temporal-owned lifecycle.
- Python AI/document sidecar.
- Renderer abstraction.
- Runtime n8n sidecar.
- Production standards conformance.

Recommended interpretation:

- The project is a credible local workbench and developer sandbox.
- It is not yet a conformance harness or production architecture.
- The next round of implementation should either finish the M8 standards harness end to end or explicitly downgrade M8 to fixture/type groundwork and polish the docs accordingly.

## Exact Implementation Map

### Exactly Implemented

- Synthetic golden MRI lumbar spine scenario.
- Synthetic missing baseline evidence scenario.
- Deterministic local Requirement Evaluation.
- Local Rule Pack loading.
- Work Item creation from Requirement Evaluation.
- SQLite default store with schema migrations.
- `PriorAuthStore` abstraction.
- `MemoryStore` for tests.
- Status transition validation.
- Questionnaire session creation and persistence.
- Deterministic questionnaire prefill.
- Questionnaire validation.
- Session revision conflict detection.
- Review-ready QuestionnaireResponse.
- Local DTR-like package endpoint.
- Parameters-shaped M7 DTR alias.
- DTR dependency fixtures with Library and ValueSet.
- Allowlisted fixture expression evaluation.
- Manual Supporting Information fixture attach.
- Manual Supporting Information local upload.
- MIME, size, base64, filename, and checksum validation for uploads.
- Supporting Information accept/remove lifecycle.
- Evidence metadata storage in SQLite schema v2.
- Local upload byte storage under ignored `.data/evidence-uploads` or configured directory.
- DocumentReference/Binary-like packet resources for accepted Supporting Information.
- Attachment manifest with digest.
- Claim-like local packet resource with supportingInfo references.
- Deterministic packet IDs based on snapshot.
- Mock PAS submission receipt.
- ClaimResponse-like response Bundle.
- Idempotent receipt behavior.
- Status events.
- Audit events.
- Operation events.
- Payer Status Updates for pended, approved, denied, cancelled.
- Additional Information Request simulation.
- Requested Information Items in local more-info payloads.
- More-info resolution on review-ready save.
- Operations queue with filters and aging.
- Operations metrics.
- Web demo for the local workflow.
- Seven screenshot artifacts.
- M5/M6/M7 architecture docs.
- Standards fixture JSON files under `data/standards`.
- Partial shared standards types for future M8 work.

### Partially Implemented

- Standards alignment: shapes and aliases exist, but conformance does not.
- DTR: local package and Parameters-shaped alias exist, but not Da Vinci DTR.
- PAS: local packet and mock submit exist, but not Da Vinci PAS or X12.
- SMART: local metadata and launch shim exist, but not OAuth launch.
- CRD: local requirement route exists, but not CDS Hooks CRD.
- Attachments: local Supporting Information Attachments exist, but not claims-attachment transactions.
- Durability: SQLite local persistence exists, but not production database or Temporal.
- Developer conformance fixtures: data and types exist, but no full harness routes/tests.
- Audit: local audit events exist, but not compliance-grade audit controls.
- Metrics: local operational metrics exist, but not CMS or enterprise reporting.

### Not Implemented

- Production SMART App Launch.
- CDS Hooks CRD.
- Da Vinci DTR conformance.
- Real FHIR `$questionnaire-package`.
- Da Vinci PAS `$submit`.
- X12 278.
- PAS inquiry/status.
- Payer endpoint discovery.
- Payer auth.
- Real payer integrations.
- Real EHR integration.
- Medplum.
- HAPI FHIR.
- Temporal.
- Python/FastAPI AI/document service.
- Docling, Marker, OCRmyPDF, Unstructured.
- OCR.
- Parser confidence.
- AI extraction.
- Human acceptance of extracted AI evidence.
- Presidio.
- Langfuse.
- OpenTelemetry.
- Keycloak.
- OpenFGA.
- Runtime n8n connectors.
- Multi-payer support.
- Multi-service-line support.
- Real PHI workflow.
- Multi-tenant deployment.
- Production security model.
- Inferno automation.
- CDS Hooks Sandbox integration.
- Da Vinci reference implementation integration.

## M8 Drift Findings

The repository currently has a mismatch between task notes and source reality.

Claims found in `tasks/todo.md`:

- M8 added standards fixture harness routes for SMART discovery, CDS Hooks primary CRD services, DTR `Questionnaire/$questionnaire-package`, and PAS `Claim/$submit`.
- M8 added M8 architecture docs, README, demo, data index, and audit documentation updates.
- M8 verification passed 57/57 tests.

Current source evidence:

- `data/standards/` fixtures are present.
- Shared standards types are present.
- No `docs/architecture/m8_*.md` file is present.
- README does not list an M8 milestone.
- Demo docs do not describe M8.
- Data index does not list `data/standards`.
- API source does not expose the M8 claimed routes.
- Tests directory has seven M1-M7 contract files, not a dedicated M8 standards harness test file.

Conclusion:

- M8 should be treated as partial and internally inconsistent until the missing routes/docs/tests are added or the task notes are corrected.

## Remaining Work By Track

### Track A: Documentation Truthfulness

Remaining:

- Update README milestones through M7 and partial M8.
- Fix repository map test coverage line from M1-M6 to current coverage.
- Add `data/standards` to `data/README.md`.
- Either add an M8 architecture note or remove/update M8 completion claims.
- Update demo docs if M8 remains in scope.
- Align docs with `CONTEXT.md` domain terms: Prior Authorization Case, Prior Authorization Request, Submission Packet, Supporting Information, Attachment, Additional Information Request, Requested Information Item, Baseline Information Gap, Requirement Evaluation, and Payer Status Update.

### Track B: Finish M8 Standards Harness

Remaining if M8 is still the next implementation target:

- Add SMART discovery fixture route under the intended FHIR base URL.
- Add `GET /cds-services`.
- Add `POST /cds-services/:serviceId` for `appointment-book`, `order-dispatch`, and `order-sign`.
- Map CDS Hooks requests to the existing Requirement Evaluation without claiming production conformance.
- Add a FHIR-style `Questionnaire/$questionnaire-package` route that consumes/returns the chosen Parameters shape.
- Add `Claim/$submit` route around local packet/receipt behavior or a standalone standards fixture response.
- Add contract tests for all standards fixture routes.
- Record harness pass/fail results distinctly from production conformance.
- Keep `conformance: false` or `productionConformance: false` until external tool validation exists.

### Track C: Domain Model Hardening

Remaining:

- Decide whether code should keep `WorkItem` as the operations object while docs describe the broader Prior Authorization Case.
- Rename user-facing "more info" text to Additional Information Request where feasible.
- Rename user-facing "evidence" where appropriate to Supporting Information, while keeping Attachment for transport/packet representation.
- Avoid describing local Requirement Evaluation as a determination.
- Model Submission Packets as repeatable support artifacts for a Prior Authorization Request in Additional Information Request loops.

### Track D: Standards And Integrations

Remaining:

- Production SMART App Launch.
- CDS Hooks CRD.
- Da Vinci DTR.
- Da Vinci PAS.
- X12 278.
- Payer endpoint discovery.
- Payer authentication.
- PAS inquiry/status.
- External conformance tooling.
- Medplum or HAPI FHIR persistence.

### Track E: Workflow Durability

Remaining:

- Introduce Temporal only after local lifecycle semantics are stable.
- Model retries, timers, async payer status polling, task assignment, cancellation, resubmission, and Additional Information Request loops as workflows.
- Keep SQLite or future database state separate from workflow history.

### Track F: Supporting Information Intelligence

Remaining:

- Add document upload classes beyond local text/base64.
- Add parser selection.
- Add OCR fallback.
- Add extraction confidence.
- Add candidate evidence mapping to Requested Information Items and Baseline Information Gaps.
- Add human review and acceptance of extracted Supporting Information.
- Add audit events for AI suggestions versus human-approved packet contents.

### Track G: Security, Compliance, And Observability

Remaining:

- Keycloak or equivalent identity.
- OpenFGA or equivalent fine-grained authorization.
- SMART token validation.
- Organization/case-level access controls.
- Presidio redaction.
- OpenTelemetry.
- Langfuse if AI features are added.
- Structured audit export.
- Secrets and environment hardening.

### Track H: Product Expansion

Remaining:

- Add a second payer.
- Add a second service line.
- Add a second questionnaire.
- Add payer-specific Rule Pack variations.
- Add richer operations dashboards.
- Add denial analytics.
- Add operator workflow assignment.
- Add role-aware review.

## Recommended Next Step

The next step should be a truth-and-alignment milestone before building new product scope.

Recommended milestone: `M8 Repair And Standards Harness Completion`.

Exit criteria:

- The project either implements the M8 standards fixture routes that `tasks/todo.md` claims, or revises the milestone notes to say only fixtures/types are present.
- README, data index, demo docs, and architecture docs agree with the source.
- Tests prove the actual M8 surface.
- The audit no longer needs to distinguish "claimed in tasks" from "implemented in code".
- Domain terms from `CONTEXT.md` are reflected in user-facing docs.

After that, choose between:

- `M9 Evidence Intelligence` if the next audience is operators and workflow usefulness.
- `M9 External Conformance Tooling` if the next audience is standards-minded implementers.

My recommendation is to finish or correct M8 first, then choose `M9 External Conformance Tooling` if credibility with healthcare implementers matters most, or `M9 Evidence Intelligence` if the priority is making the workbench feel operationally useful.
