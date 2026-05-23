# Open Prior Auth Workbench Audit

## Doctor Agent OS Roadmap Spec

### Canonical Direction

- **Domain**: provider-side prior authorization.
- **Implementation substrate**: Doctor Agent OS.
- **First app**: Open Prior Auth Agent Workbench.
- **Current baseline**: existing M1-M7 synthetic prior-auth workbench remains working baseline.
- **Near-term rule**: deepen prior-auth first; broader healthcare administrative workflows are future expansion only.
- **Production posture**: synthetic-only, standards-shaped, non-certified, not PHI-ready, not connected to live EHRs or payers.

### Canonical Architecture Rules

- `CONTEXT.md` is the working modeling source of truth.
- `docs/glossary.md` is the public stabilized glossary mirror; sync it from `CONTEXT.md`.
- `PriorAuthorizationCase` is the domain root.
- `WorkItem` is an operational queue/task projection of a `PriorAuthorizationCase`.
- `PriorAuthorizationCase.lifecycleStatus` is provider-side workflow state only.
- `PayerUpdate` owns payer status messages such as pended and more-info requested.
- `PayerDetermination` owns final payer outcomes: approved, denied, cancelled.
- `PriorAuthorizationRequest.requestStatus` is a payer-facing thread phase and does not include final payer outcomes.
- Routine more-info/correction flows use the same `PriorAuthorizationRequest`, a new `SubmissionPacket`, and the same payer tracking thread unless service, payer, coverage, or payer instruction forces a new request.
- Use Cases are the source of truth for application actions.
- HTTP routes and ToolNet tools are sibling adapters over Use Cases.
- ToolNet tools must not call internal HTTP routes.
- MCP exposes selected ToolNet tools and does not bypass ToolNet for case-changing actions.
- `apps/*` may import `packages/*`; `packages/*` must not import `apps/*`.
- M0 has no ADRs. Revisit ADRs after M1a/M1b enforce package and import boundaries.

### M0: Agentic Alignment + Repo Reset

Goal: align public docs, roadmap, glossary, audit, and package map around Doctor Agent OS as substrate while preserving current M1-M7 baseline.

Scope:

- [x] Update `README.md` as concise front door:
  - [x] Doctor Agent OS = implementation substrate.
  - [x] Open Prior Auth Agent Workbench = first app/domain.
  - [x] current M1-M7 baseline preserved.
  - [x] quickstart unchanged.
  - [x] safety/conformance boundaries clear.
  - [x] link to `docs/roadmap.md`, `docs/glossary.md`, architecture docs, demo story, conformance matrix.
- [x] Create `docs/roadmap.md` as detailed roadmap source of truth:
  - [x] include M0 through M9.
  - [x] each milestone has goal, scope, out of scope, exit criteria, files/packages affected.
  - [x] note production-path docs planned for M9; do not create `docs/production-path/` in M0.
- [x] Create `docs/glossary.md` as public stabilized mirror of `CONTEXT.md`.
- [x] Create `docs/architecture/doctor-agent-os.md`.
- [x] Create `docs/architecture/prior-auth-core.md`.
- [x] Create `docs/architecture/toolnet.md`.
- [x] Create `docs/architecture/runtime.md`.
- [x] Create `docs/architecture/mcp.md`.
- [x] Create `docs/standards/conformance-matrix.md`.
- [x] Create `docs/demo/agentic-story-flow.md`.
- [x] Add README-only package placeholders:
  - [x] `packages/prior-auth-core/README.md`
  - [x] `packages/doctor-toolnet/README.md`
  - [x] `packages/doctor-runtime/README.md`
  - [x] `packages/doctor-mcp/README.md`
  - [x] `packages/doctor-evals/README.md`
- [x] Do not add package manifests or build config:
  - [x] no new `package.json`
  - [x] no new `tsconfig.json`
  - [x] no functional code
  - [x] no lockfile/package identity churn
- [x] Add pre-agentic-baseline banner to old M1-M7 architecture docs without rewriting bodies.
- [x] Archive old stale audit:
  - [x] move `docs/architecture/strategy_report_implementation_audit.md` to `docs/architecture/archive/strategy_report_implementation_audit_2026-04-29.md`
  - [x] create new current `docs/architecture/strategy_report_implementation_audit.md`
  - [x] new audit summarizes May 22 Doctor Agent OS alignment, current M1-M7 baseline, roadmap landing points, and archived audit link.
- [x] Keep root `package.json` name as `open-prior-auth-workbench`.
- [x] Update `tasks/todo.md` with final roadmap/spec and M0 checklist.

Out of scope:

- ADRs.
- code extraction.
- ToolNet implementation.
- MCP implementation.
- runtime implementation.
- UI redesign.
- production-path docs.
- database migrations.
- root package rename.

Verification:

- [x] `npm test`
- [x] `npm run typecheck`
- [x] `npm run build`
- [x] lightweight docs/link sanity check for new roadmap/audit/banner links.
- [x] no browser smoke unless quickstart or runtime behavior changes.

M0 exit criteria:

- [x] README, roadmap, glossary, architecture docs, package READMEs, audit, and todo agree.
- [x] Doctor Agent OS is described as implementation substrate, not expanded business domain.
- [x] Open Prior Auth Agent Workbench remains first and only committed app/domain.
- [x] Existing M1-M7 workbench is preserved as current baseline.
- [x] M1a is clearly Prior Auth Core extraction.
- [x] M1b is clearly ToolNet foundation.
- [x] No doc claims PHI readiness, certified Da Vinci conformance, live payer transport, or real EHR integration.
- [x] Package dependency direction is explicit.
- [x] Domain model is pinned.
- [x] No functional implementation beyond docs/scaffolds.

### M0 Review

- Implemented M0 as docs/scaffold-only reset around Doctor Agent OS as implementation substrate and Open Prior Auth Agent Workbench as the first app/domain.
- Preserved quickstart, root package name, current API/runtime behavior, M1-M7 baseline docs, and package/build config.
- Archived the April 29 strategy audit and wrote the current May 22 alignment audit at the canonical path.
- Added README-only placeholders for planned Doctor Agent OS packages; verified no new `package.json` or `tsconfig.json` files were added there.
- Docs sanity: checked local Markdown links, M1-M7 banners, placeholder package contents, and root package name.
- Verification: first sandboxed `npm test` failed only on expected `listen EPERM: operation not permitted 127.0.0.1`; rerun with localhost permission passed 51/51.
- Verification: `npm run typecheck` passed.
- Verification: `npm run build` passed.
- Browser smoke not run because quickstart/runtime behavior did not change.

### M1a: Extract Prior Auth Core

Goal: create `packages/prior-auth-core` as the provider-side prior-auth Use Case and ports package.

Scope:

- [ ] Create real package manifest/config for `packages/prior-auth-core`.
- [ ] Introduce simple string ID aliases, not branded IDs:
  - [ ] `PriorAuthorizationCaseId`
  - [ ] `PriorAuthorizationRequestId`
  - [ ] `SubmissionPacketId`
  - [ ] `PayerUpdateId`
  - [ ] `PayerDeterminationId`
  - [ ] `WorkItemId`
- [ ] Add ports:
  - [ ] `PriorAuthStore`
  - [ ] `ClinicalContextRepository`
  - [ ] `Clock`
  - [ ] `IdGenerator`
- [ ] Extract/use core Use Cases:
  - [ ] `getPriorAuthorizationCase`
  - [ ] `listWorkItems`
  - [ ] `evaluateRequirements`
  - [ ] `getQuestionnairePackage`
  - [ ] `saveQuestionnaireResponse`
  - [ ] `listEvidence`
  - [ ] `buildSubmissionPacket`
  - [ ] `submitMockPacket`
  - [ ] `getCaseStatusTimeline`
  - [ ] `getCaseAuditTrace`
- [ ] Keep current API routes and UI behavior working.
- [ ] Do not expose agent-callable tools yet.
- [ ] Do not rename DB tables.
- [ ] Do not add UI changes.

Exit criteria:

- [ ] `apps/api` imports `prior-auth-core` for listed Use Cases.
- [ ] `prior-auth-core` does not import `apps/api`.
- [ ] Existing API tests pass.
- [ ] Existing UI/demo behavior remains unchanged.
- [ ] `PriorAuthorizationCase` is the domain root.
- [ ] `WorkItem` is queue projection.
- [ ] `PriorAuthorizationRequest`, `SubmissionPacket`, `PayerUpdate`, and `PayerDetermination` types are defined or stubbed where needed.
- [ ] No ToolNet handlers exist yet.

### M1b: Doctor ToolNet Foundation

Goal: add ToolNet as the agent/tool adapter over `prior-auth-core`, with executable read/draft tools only.

Scope:

- [ ] Create real package manifest/config for `packages/doctor-toolnet`.
- [ ] Add ToolNet registry, tool metadata, schemas, categories, risk levels, approval metadata, and call record shape.
- [ ] Executable read/draft tools:
  - [ ] `doctor.case.get`
  - [ ] `doctor.queue.list_work_items`
  - [ ] `doctor.case.get_status_timeline`
  - [ ] `doctor.case.get_audit_trace`
  - [ ] `doctor.evidence.list`
  - [ ] `doctor.requirements.evaluate`
  - [ ] `doctor.dtr.get_questionnaire_package`
  - [ ] `doctor.pas.build_packet`
- [ ] Declared but non-executable guarded tools:
  - [ ] `doctor.dtr.save_response`
  - [ ] `doctor.pas.submit_mock`
- [ ] Guarded tools return deterministic `APPROVAL_EXECUTOR_REQUIRED`.
- [ ] Tests prove ToolNet does not fetch localhost or import `apps/api`.

Out of scope:

- Approval executor.
- MCP.
- runtime.
- write/submit execution.
- evidence attach/upload tools.
- payer status mutation tools.
- queue assignment tools.

Exit criteria:

- [ ] Agents/tools can safely inspect, reason, draft, and preview prior-auth work.
- [ ] Write/submit capabilities are visible as planned/guarded contracts but not callable.
- [ ] Existing API/UI behavior still works.

### M2: Doctor Runtime + ApprovalGate

Goal: add minimal runtime lifecycle, approval pause/resume, and durable trace state.

Scope:

- [ ] Create real package manifest/config for `packages/doctor-runtime`.
- [ ] Runtime primitives are workflow-agnostic:
  - [ ] `AgentRun`
  - [ ] `AgentTask`
  - [ ] `TaskPlan`
  - [ ] `ToolCallRecord`
  - [ ] `ApprovalRequest`
  - [ ] `ApprovalDecision`
  - [ ] `TraceEvent`
- [ ] Use prior-auth-only validation through MRI/DME scenarios.
- [ ] Add SQLite runtime tables:
  - [ ] `agent_runs`
  - [ ] `agent_tasks`
  - [ ] `tool_call_records`
  - [ ] `approval_requests`
  - [ ] `agent_trace_events`
- [ ] `agent_trace_events` is canonical ordered trace stream.
- [ ] task/tool/approval tables are structured state/index tables.
- [ ] Guarded write/submit tools can pause and create approval requests.
- [ ] Approve/reject records trace events and resumes or rejects run.

Out of scope:

- Postgres.
- Temporal.
- JSON-file runtime state.
- prior-auth schema rename.
- broad multi-agent team.
- generic healthcare workflow API.

### M3: Deterministic Prior-Auth Agent Team

Goal: implement replayable scripted agent team over Runtime + ToolNet.

Scope:

- [ ] Deterministic roles:
  - [ ] `PriorAuthOrchestratorAgent`
  - [ ] `RequirementDiscoveryAgent`
  - [ ] `DocumentationAgent`
  - [ ] `EvidenceAgent`
  - [ ] `PacketAssemblyAgent`
  - [ ] `ComplianceBoundaryAgent`
- [ ] MRI happy path run:
  - [ ] queue -> case -> requirements -> questionnaire package -> evidence list -> packet preview -> approval request.
- [ ] Minimal golden trace smoke test:
  - [ ] ordered agents.
  - [ ] ordered tools.
  - [ ] approval request exists for guarded submit.
  - [ ] final run status `waiting_for_human`.
- [ ] No live LLM required for happy path.

Out of scope:

- model-backed agents.
- autonomous queue processing.
- real payer submission.
- broad agent platform.

### M4: Reusable Prior-Auth Domain Proof

Goal: prove the same core/runtime/tool path supports a second payer/service-line scenario.

Scenario:

- Public/demo name: DME Wheelchair Authorization.
- Internal service line: `dme_power_wheelchair`.
- Payer: Blue Ridge Health.

Scope:

- [ ] Add synthetic DME power wheelchair scenario.
- [ ] Add payer rule pack, questionnaire, evidence fixtures, and packet preview support.
- [ ] Same workflow runs for MRI/Acme and DME/Blue Ridge:
  - [ ] queue
  - [ ] case read
  - [ ] requirements evaluation
  - [ ] questionnaire package
  - [ ] evidence list
  - [ ] packet preview
  - [ ] approval request
  - [ ] trace output
- [ ] No DME-specific orchestrator or copied workflow.

### M5: Agent Cockpit

Goal: build prior-auth cockpit where business case state is primary and agent trace is visible trust/debug layer.

Scope:

- [ ] One page supports MRI and DME scenarios.
- [ ] Primary hierarchy:
  - [ ] case header
  - [ ] current blocker / next action
  - [ ] agent run timeline
  - [ ] evidence-to-requirement board
  - [ ] questionnaire/package summary
  - [ ] packet preview
  - [ ] audit/status timeline
  - [ ] scenario switcher
- [ ] Do not make trace the top-level object.
- [ ] No full analytics dashboard yet.

### M6: Standards-Shaped ToolNet Tools

Goal: make internal ToolNet/core actions standards-shaped before exposing protocol routes.

Scope:

- [ ] Add standards-shaped ToolNet tools:
  - [ ] `doctor.crd.discover_services`
  - [ ] `doctor.crd.invoke_service`
  - [ ] `doctor.dtr.get_questionnaire_package`
  - [ ] `doctor.pas.build_packet`
  - [ ] `doctor.pas.submit_mock`
- [ ] Keep submit guarded by M2 ApprovalGate.
- [ ] Add standards mappers/schemas and fixture-level tests.
- [ ] Maintain synthetic/non-conformant claim language.

### M7: Standards Gateway HTTP Routes + Tests

Goal: expose standards-shaped HTTP adapters over ToolNet/core and validate via fixture tests.

Scope:

- [ ] Routes:
  - [ ] `GET /fhir/.well-known/smart-configuration`
  - [ ] `GET /cds-services`
  - [ ] `POST /cds-services/open-prior-auth-order-sign`
  - [ ] optional `POST /cds-services/open-prior-auth-appointment-book`
  - [ ] optional `POST /cds-services/open-prior-auth-order-dispatch`
  - [ ] `POST /fhir/Questionnaire/$questionnaire-package`
  - [ ] `POST /fhir/Claim/$submit`
- [ ] OperationOutcome-style errors.
- [ ] Conformance matrix fixture tests.
- [ ] No certification/conformance claim.

### M8: Formal Doctor Evals

Goal: add narrow deterministic regression/safety harness, not eval platform.

Scope:

- [ ] Create real package manifest/config for `packages/doctor-evals`.
- [ ] Scenario registry:
  - [ ] `mri_happy_path`
  - [ ] `dme_power_wheelchair_happy_path`
  - [ ] `mri_missing_evidence`
  - [ ] `mri_prompt_injection_evidence`
- [ ] Golden trace diffs.
- [ ] Tool policy assertions:
  - [ ] no unexpected tools.
  - [ ] guarded writes require approval.
  - [ ] no guarded write executes without ApprovalGate.
  - [ ] no internal HTTP route/tool calls from agents.
- [ ] Safety assertions:
  - [ ] no PHI-ready claim.
  - [ ] no certified conformance claim.
  - [ ] no real payer submission claim.
  - [ ] evidence text treated as data, not instruction.
- [ ] `npm run evals`.
- [ ] JSON and markdown reports.

Out of scope:

- LLM judge.
- model benchmarking.
- eval dashboard UI.
- production observability.
- Langfuse/OpenTelemetry.

### M9: Production-Path Docs

Goal: document production path without implementing production system.

Scope:

- [ ] Create `docs/production-path/` only in M9.
- [ ] Docs:
  - [ ] `README.md`
  - [ ] `fhir-data-plane.md`
  - [ ] `security-authz-audit.md`
  - [ ] `ehr-payer-integration.md`
  - [ ] `deployment-observability.md`
  - [ ] `conformance-test-path.md`
- [ ] Every doc includes:
  - [ ] current OSS posture.
  - [ ] production requirement.
  - [ ] adapter/interface to build.
  - [ ] explicit non-goals.
  - [ ] risks/blockers.
  - [ ] sequence prerequisites.

Out of scope:

- Medplum/HAPI implementation.
- Keycloak/OpenFGA implementation.
- real SMART App Launch.
- real payer transport.
- OpenTelemetry/Langfuse implementation.
- Kubernetes hardening.
- production PHI storage.

### Next Action

- [ ] Pause and ask whether to execute M0 as a separate implementation pass.

## Updated Strategy Status Read

### Plan

- [x] Read updated `open_prior_auth_workbench_strategy_report.pdf`.
- [x] Recheck updated todos, audits, README, demo, architecture, data, and task docs.
- [x] Reconcile current source/test surface with updated north-star plan.
- [x] Report completed work and remaining work against production-ready prior-auth workbench north star.

### Review

- The updated 25-page PDF now repositions the project as Doctor Agent OS with Open Prior Auth Agent Workbench as the first application.
- Current checked-in source and public docs still implement/describe the M1-M7 synthetic prior-auth workbench, not the new Doctor Runtime / ToolNet / MCP / agent cockpit system.
- Verification: sandboxed `npm test` failed only on localhost binding; rerun with localhost permission passed 51/51. `npm run typecheck` passed. `npm run build` passed.

## Repo Status Inventory

### Plan

- [x] Inventory repo files, excluding generated dependency/build folders.
- [x] Extract and inspect `open_prior_auth_workbench_strategy_report.pdf`.
- [x] Compare report intent against docs, API, web app, fixtures, tests, demo, and task history.
- [x] Summarize completed work and remaining work for the user.

### Review

- Current repo implements a synthetic local M1-M7 Open Prior Auth Workbench for one MRI lumbar spine / Acme Health scenario.
- PDF strategy asks for a broader production-ready architecture: SMART, CRD, DTR, PAS, FHIR platform, Temporal, document/AI service, authz, observability, and real payer/EHR integration.
- M8 is only partially present as standards fixture/type groundwork; current source does not expose full CDS Hooks, FHIR `$questionnaire-package`, or PAS `Claim/$submit` route harnesses.
- Verification: sandboxed `npm test` failed only on `127.0.0.1` bind permission; rerun with localhost permission passed 51/51. `npm run typecheck` passed. `npm run build` passed.

## Fourth Strategy Report Audit

### Plan

- [x] Re-read `CONTEXT.md` and `tasks/lessons.md` to align the audit language with current domain decisions.
- [x] Re-extract and render `open_prior_auth_workbench_strategy_report.pdf`.
- [x] Inventory implementation changes since the third audit, with emphasis on M8 standards conformance fixture harness work.
- [x] Compare every report section against current code, docs, fixtures, tests, API routes, and web UI.
- [x] Update `docs/architecture/strategy_report_implementation_audit.md` with the fourth-round implemented, partial, not implemented, and remaining-work map.
- [x] Run verification and record results.

### Review

- Re-read `CONTEXT.md` and `tasks/lessons.md` and updated the audit language around Prior Authorization Case, Work Item, Prior Authorization Request, Submission Packet, Supporting Information, Attachment, Baseline Information Gap, Additional Information Request, Requested Information Item, Requirement Evaluation, Payer Status Update, and Payer Determination.
- Re-extracted the 14-page PDF report to text and rendered page PNGs under `tmp/pdfs/` for review, then removed the temporary files.
- Re-audited current implementation against the strategy report, with special attention to the M8 standards fixture/type groundwork and the mismatch between M8 task claims and current API source.
- Updated `docs/architecture/strategy_report_implementation_audit.md` as the fourth full audit, including exact implemented, partial, not implemented, remaining-work, and M8 drift sections.
- Verification: initial sandboxed `npm test` rebuilt successfully but failed only because API route tests could not bind `127.0.0.1`.
- Verification: rerun `npm test` passed 51/51 tests with localhost permission. Node emitted expected experimental `node:sqlite` warnings during SQLite tests.
- Verification: `npm run typecheck` passed across API, web, and shared-types workspaces.
- Verification: `npm run build` passed across API, web, and shared-types workspaces.

## Domain Model Grilling Session

### Plan

- [x] Read the strategy report, implementation audit, repository map, and available milestone docs.
- [x] Inventory the current domain language in code, fixtures, and documentation.
- [x] Ask one unresolved domain question at a time, with a recommended answer.
- [x] Capture resolved domain terms in `CONTEXT.md` as decisions are made.
- [ ] Add ADRs only if a resolved decision is hard to reverse, surprising, and trade-off driven.
- [ ] Document session results and verification notes.

### Review

- Session in progress.
- Resolved: Doctor Agent OS is implementation platform/technical umbrella, not expanded business domain; Open Prior Auth Agent Workbench remains near-term product/domain.
- Resolved: M0 is Agentic Alignment + Repo Reset; M1a is Prior Auth Core extraction; M1b is ToolNet foundation.
- Resolved: M0 creates README-only placeholder package directories, with no `package.json`, `tsconfig.json`, functional code, or build behavior changes.
- Resolved: M0 keeps old M1-M7 milestone docs intact except for a short pre-agentic-baseline banner linking to `docs/roadmap.md`.
- Resolved: M0 archives the stale April 29 audit and creates a new current strategy alignment audit at the canonical path.
- Resolved: M0 does not rename the root `package.json`; package identity stays `open-prior-auth-workbench` until a separate package-management milestone.
- Resolved: M0 verification is no-behavior-changed only: `npm test`, `npm run typecheck`, `npm run build`, plus lightweight docs/link sanity; no browser smoke unless quickstart/runtime changes.
- Resolved: After the grill session, consolidate the roadmap/spec into `tasks/todo.md`, then pause for explicit approval before implementing M0.
- Resolved: M1a Prior Auth Core extraction and M1b ToolNet foundation are separate PRs/milestones.
- Resolved: M0 does not create `docs/production-path/`; production-path docs are planned for M9 only.
- Resolved: `CONTEXT.md` remains modeling source of truth; `docs/glossary.md` will be public stabilized mirror.
- Resolved: no ADRs in M0; revisit ADRs after M1a/M1b enforce package/import boundaries.
- Resolved: Use Cases are source of truth; HTTP routes and ToolNet tools are sibling adapters over Use Cases.
- Resolved: M1a includes minimal `packages/prior-auth-core` extraction; M1b adds `packages/doctor-toolnet`.
- Resolved: `PriorAuthorizationCase` is domain root; `WorkItem` is queue/task projection.
- Resolved: provider lifecycle, payer updates, payer determinations, and queue effective status are separate status models.
- Resolved: more-info/correction/default supplement flow is same `PriorAuthorizationRequest`, new `SubmissionPacket`, same payer tracking thread unless payer/service/coverage changes force new request.
- Resolved: `PriorAuthorizationRequestStatus` avoids final payer outcomes; use `PayerDetermination` for approved/denied/cancelled.
- Resolved: M1a uses simple string ID aliases, not branded IDs.
- Resolved: M1b executable ToolNet tools are read/draft only; guarded write/submit tools are declared but non-executable until M2 approval runtime.
- Resolved: ApprovalGate belongs in M2 Doctor Runtime, not M1c.
- Resolved: M2 Runtime persistence uses new SQLite tables for agent runs, tasks, tool call records, approval requests, and trace events; no JSON runtime state, Postgres, Temporal, or prior-auth schema rename.
- Resolved: `agent_trace_events` is the canonical ordered runtime trace stream; task/tool/approval tables are structured indexes/state tables.
- Resolved: M2 runtime primitives are workflow-agnostic, but validation/use remains prior-auth-only via MRI/DME scenarios.
- Resolved: M3 uses deterministic/replayable Prior-Auth Agent Team; model-backed mode comes later.
- Resolved: M3 gets minimal golden trace smoke test; formal Doctor Evals lands later.
- Resolved: M6 adds internal standards-shaped ToolNet tools; M7 adds standards gateway HTTP routes and conformance matrix fixture tests.
- Resolved: M4 moves earlier as Reusable Prior-Auth Domain Proof with second payer/service line before cockpit and standards gateway.
- Resolved: M4 second scenario is DME Power Wheelchair Authorization for Blue Ridge Health, internal service line `dme_power_wheelchair`, using same workflow with fixture-driven variation.
- Resolved: M5 Agent Cockpit is business-case-state first, with agent trace as a trust/debug layer on the same page.
- Resolved: M8 Doctor Evals is a narrow deterministic regression/safety harness with four scenarios, golden trace diffs, tool policy checks, safety claim checks, JSON and markdown reports, and `npm run evals`; no LLM judge/dashboard/observability.

## M8 Standards Conformance Fixture Harness

### Plan

- [x] Add M8 task tracking and standards-shape lessons.
- [x] Add shared M8 SMART, CRD, DTR, PAS, Parameters, and harness contract types.
- [x] Add standards fixture payloads for SMART discovery, CRD primary hooks, DTR questionnaire package, and PAS Claim submit.
- [x] Implement M8 standards-shaped adapter methods and routes while preserving existing local aliases.
- [x] Add M8 architecture, README, demo, data index, and audit documentation updates.
- [x] Add standards conformance contract tests and local alias regression coverage.
- [x] Verify with `npm test`, `npm run typecheck`, and `npm run build`.

### Review

- Added M8 standards fixture harness routes for SMART discovery, CDS Hooks primary CRD services, DTR `Questionnaire/$questionnaire-package`, and PAS `Claim/$submit`.
- Added standards fixtures under `data/standards/` and shared contracts for SMART discovery metadata, CDS Hooks envelopes, FHIR Parameters, and M8 harness responses.
- Preserved existing local aliases including `/dtr/questionnaire-package`, `/pas/submit-local`, and `/.well-known/smart-configuration`.
- Updated M8 architecture docs, README, demo guide, data index, audit note, and lessons.
- Verification: initial sandboxed `npm test` failed only because route tests could not bind `127.0.0.1`.
- Verification: rerun `npm test` passed 57/57 tests with localhost permission. Node emitted expected experimental `node:sqlite` warnings during SQLite tests.
- Verification: `npm run typecheck` passed across API, web, and shared-types workspaces.
- Verification: `npm run build` passed across API, web, and shared-types workspaces.

## Third Audit Round

### Plan

- [x] Re-extract and outline `open_prior_auth_workbench_strategy_report.pdf`.
- [x] Inventory current implementation changes since the second audit, with emphasis on M7 evidence attachments and DTR boundary work.
- [x] Compare every report section against current code, docs, fixtures, tests, API routes, and web UI.
- [x] Update `docs/architecture/strategy_report_implementation_audit.md` with the third-round implemented, partial, not implemented, and remaining-work map.
- [x] Run verification and record results.

### Review

- Re-extracted the 14-page PDF report to text and rendered page PNGs under `tmp/pdfs/` for review.
- Re-audited the current implementation against the report, including M7 evidence fixtures, EvidenceRepository, SQLite schema v2, evidence lifecycle routes, upload validation, DTR dependencies, fixture expression evaluation, standards aliases, M7 packet manifests, and web evidence controls.
- Updated `docs/architecture/strategy_report_implementation_audit.md` with the third-round implemented/partial/not-implemented map and remaining work by track.
- Verification: `npm test` passed 51/51 tests with localhost permission. Node emitted expected experimental `node:sqlite` warnings during SQLite tests.
- Verification: `npm run typecheck` passed across API, web, and shared-types workspaces.
- Verification: `npm run build` passed across API, web, and shared-types workspaces.

## M7 Evidence Attachments And DTR Boundary

### Plan

- [x] Add shared M7 evidence, attachment manifest, DTR dependency, and standards-boundary contracts.
- [x] Add synthetic evidence, Library, ValueSet, and fixture-expression data.
- [x] Implement SQLite schema version 2 with evidence metadata, upload file pointers, migration coverage, and old packet read compatibility.
- [x] Implement the evidence repository, evidence lifecycle routes, upload validation, and audit events.
- [x] Update packet building to include accepted evidence, DocumentReference/Binary-like entries, Claim supportingInfo references, and stable evidence digests.
- [x] Add local DTR dependency packaging with Parameters-shaped standards alias and allowlisted fixture-expression evaluation.
- [x] Add standards-shaped SMART/CRD/DTR/PAS/evidence boundary metadata and aliases with explicit non-conformance.
- [x] Add web evidence controls for fixture attach, upload, accept/remove, and packet manifest review.
- [x] Add M7 docs, demo notes, and fixture index updates.
- [x] Verify with `npm test`, `npm run typecheck`, `npm run build`, and a local smoke check.

### Review

- Implemented `EvidenceRepository`, SQLite schema v2 evidence metadata, ignored upload file storage, upload validation, evidence lifecycle audit events, and M7 packet evidence manifests.
- Added synthetic evidence fixtures, DTR Library/ValueSet dependencies, a Parameters-shaped DTR alias, and a named allowlist fixture-expression evaluator.
- Added standards-shaped SMART/CRD/DTR/PAS/evidence aliases with explicit local non-conformance metadata.
- Added web evidence controls for fixture attach, local text upload, accept/remove, and manifest review.
- Added M7 architecture/demo/data docs and expanded contract coverage for uploads, evidence digest stability, migration compatibility, audit events, DocumentReference modes, DTR dependencies, and route boundaries.
- Verification: `npm test` passed 51/51 tests with localhost permission. Node emitted expected experimental `node:sqlite` warnings during SQLite tests.
- Verification: `npm run typecheck` passed across API, web, and shared-types workspaces.
- Verification: `npm run build` passed across API, web, and shared-types workspaces.
- Smoke check: local API M7 flow evaluated requirements, created the golden work item, checked standards boundaries, attached and accepted evidence, marked the questionnaire ready, built an M7 packet, and returned one manifest attachment.

## Current Redo Audit

### Plan

- [x] Re-extract and outline `open_prior_auth_workbench_strategy_report.pdf`.
- [x] Re-inventory the current implementation since the first audit, with special attention to M6 durable standards-boundary work.
- [x] Compare every report section against the current code, docs, tests, data, and scripts.
- [x] Update `docs/architecture/strategy_report_implementation_audit.md` with current implemented, partial, not implemented, and remaining-work status.
- [x] Verify tests, typecheck, and build before marking the audit complete.

### Review

- Re-extracted the 14-page PDF report to text and rendered page PNGs under `tmp/pdfs/` for review.
- Re-audited the current implementation against the report, including the M6 SQLite persistence, `PriorAuthStore`, transaction boundaries, standards-shaped local adapters, DB scripts, CI/runtime changes, and new tests.
- Updated `docs/architecture/strategy_report_implementation_audit.md` with the current implemented/partial/not-implemented map and remaining work by track.
- Verification: `npm test` passed 42/42 tests with localhost permission for API route tests. Node emitted expected experimental `node:sqlite` warnings during SQLite tests.
- Verification: `npm run typecheck` passed across API, web, and shared-types workspaces.
- Verification: `npm run build` passed across API, web, and shared-types workspaces.

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
