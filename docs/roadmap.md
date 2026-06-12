# Doctor Agent OS Roadmap

This roadmap records the implemented M0-M9 path and remaining direction for Doctor Agent OS while preserving the current synthetic Open Prior Auth Agent Workbench baseline.

## Canonical Direction

- Domain: provider-side prior authorization.
- Implementation substrate: Doctor Agent OS.
- First app: Open Prior Auth Agent Workbench.
- Current baseline: M1-M8 synthetic prior-auth workbench plus M9 production-path documentation.
- Near-term rule: deepen prior-auth first; broader healthcare administrative workflows are future expansion only.
- Production posture: synthetic-only, standards-shaped, non-certified, not PHI-ready, not connected to live EHRs or payers.

## Architecture Rules

- `CONTEXT.md` is the working modeling source of truth.
- `docs/glossary.md` is the public stabilized glossary mirror.
- `PriorAuthorizationCase` is the domain root.
- `WorkItem` is an operational queue/task projection of a `PriorAuthorizationCase`.
- `PriorAuthorizationCase.lifecycleStatus` is provider-side workflow state only.
- `PayerUpdate` owns non-final payer status messages such as pended and more-info requested.
- `PayerDetermination` owns final payer outcomes: approved, denied, cancelled.
- `PriorAuthorizationRequest.requestStatus` is a payer-facing thread phase and does not include final payer outcomes.
- Routine more-info/correction flows use the same `PriorAuthorizationRequest`, a new `SubmissionPacket`, and the same payer tracking thread unless service, payer, coverage, or payer instruction forces a new request.
- Use Cases are the source of truth for application actions.
- HTTP routes and ToolNet tools are sibling adapters over Use Cases.
- ToolNet tools must not call internal HTTP routes.
- When MCP is implemented, it should expose selected ToolNet tools and must not bypass ToolNet for case-changing actions.
- `apps/*` may import `packages/*`; `packages/*` must not import `apps/*`.
- No ADRs were added in M0. Revisit ADRs only when a new decision is hard to reverse, surprising, and trade-off driven.

## M0: Agentic Alignment + Repo Reset

Status: complete.

Goal: align public docs, roadmap, glossary, audit, and package map around Doctor Agent OS as substrate while preserving the prior M1-M7 baseline.

Scope: refresh README, create roadmap/glossary/architecture/conformance/demo docs, add initial package placeholders, add pre-agentic banners to M1-M7 docs, archive stale audit, create current audit, and update task tracking.

Out of scope: ADRs, code extraction, ToolNet implementation, MCP implementation, runtime implementation, UI redesign, production-path docs, database migrations, and root package rename.

Exit criteria: README, roadmap, glossary, architecture docs, package READMEs, audit, and todo agree; Doctor Agent OS is substrate; Open Prior Auth Agent Workbench remains first committed app; M1a/M1b are clear next package milestones; no production or conformance claims.

Files/packages affected: `README.md`, `docs/`, `packages/*/README.md`, `tasks/todo.md`.

## M1a: Extract Prior Auth Core

Status: complete.

Goal: create `packages/prior-auth-core` as the provider-side prior-auth Use Case and ports package.

Scope: create a real package manifest/config, add simple string ID aliases, define ports, extract current prior-auth Use Cases, and keep API/UI behavior unchanged.

Out of scope: ToolNet, MCP, UI changes, DB table renames, and agent-callable tools.

Exit criteria: `apps/api` imports prior-auth Use Cases from `prior-auth-core`; `prior-auth-core` does not import `apps/api`; existing behavior/tests pass; `PriorAuthorizationCase` remains root and `WorkItem` remains queue projection.

Files/packages affected: `packages/prior-auth-core`, `apps/api`, `packages/shared-types`, `tests`.

## M1b: Doctor ToolNet Foundation

Status: complete.

Goal: add ToolNet as the agent/tool adapter over `prior-auth-core`, with executable read/draft tools only.

Scope: create a real package, add registry/metadata/schemas/risk/approval metadata/call record shape, implement read/draft tools, and declare guarded write/submit tools as non-executable.

Out of scope: Approval executor, MCP, runtime, write/submit execution, evidence upload tools, payer mutation tools, and queue assignment tools.

Exit criteria: tools can inspect, reason, draft, and preview prior-auth work; guarded tools return deterministic `APPROVAL_EXECUTOR_REQUIRED`; tests prove ToolNet does not fetch localhost or import `apps/api`.

Files/packages affected: `packages/doctor-toolnet`, `packages/prior-auth-core`, `tests`.

## M2: Doctor Runtime + ApprovalGate

Status: complete.

Goal: add minimal workflow-agnostic runtime lifecycle, approval pause/resume, and durable trace state.

Scope: create `packages/doctor-runtime`; add `AgentRun`, `AgentTask`, `TaskPlan`, `ToolCallRecord`, `ApprovalRequest`, `ApprovalDecision`, `TraceEvent`, and a generic runtime tool-catalog boundary; add SQLite runtime tables; pause guarded writes for approval and resume/reject after human decision.

Out of scope: Postgres, Temporal, JSON-file runtime state, prior-auth schema rename, broad multi-agent teams, and generic healthcare workflow API.

Exit criteria: guarded write/submit tools create approval requests; approval decisions produce trace events; `agent_trace_events` is canonical ordered trace stream.

Files/packages affected: `packages/doctor-runtime`, `packages/doctor-toolnet`, `apps/api`, SQLite scripts/tests.

## M3: Deterministic Prior-Auth Agent Team

Status: complete.

Goal: implement replayable scripted prior-auth agent team over Runtime + ToolNet.

Scope: add `packages/prior-auth-agent-team` with deterministic orchestrator, requirement discovery, documentation, evidence, packet assembly, compliance boundary roles, and ToolNet runtime bridge; support MRI happy path from queue to approval request; add minimal golden trace smoke test.

Out of scope: model-backed agents, autonomous queue processing, real payer submission, and broad agent platform.

Exit criteria: no live LLM required for happy path; trace contains ordered agents/tools; guarded submit stops at `waiting_for_human`.

Files/packages affected: `packages/prior-auth-agent-team`, `packages/doctor-runtime`, `packages/doctor-toolnet`, `packages/prior-auth-core`, `tests`.

## M4: Reusable Prior-Auth Domain Proof

Status: complete.

Goal: prove the same core/runtime/tool path supports a second payer/service-line scenario.

Scope: add DME Power Wheelchair Authorization for Blue Ridge Health with synthetic rule pack, questionnaire, evidence fixtures, packet preview support, and same workflow path as MRI.

Out of scope: DME-specific orchestrator, copied workflows, production payer integration, and broad multi-service analytics.

Exit criteria: MRI/Acme and DME/Blue Ridge both run through queue, case read, requirements, questionnaire, evidence, packet preview, approval request, and trace output using shared workflow.

Files/packages affected: `data`, `packages/prior-auth-core`, `packages/doctor-toolnet`, `packages/doctor-runtime`, `packages/prior-auth-agent-team`, `apps/api`, `apps/web`, `tests`.

## M5: Agent Cockpit

Status: complete.

Goal: build prior-auth cockpit where business case state is primary and agent trace is visible trust/debug layer.

Scope: one page supports MRI and DME scenarios with case header, current blocker/next action, agent run timeline, evidence-to-requirement board, questionnaire/packet summary, packet preview, audit/status timeline, and scenario switcher.

Out of scope: full analytics dashboard, generic agent console, and trace-first UI.

Exit criteria: staff can operate from case state first; trace explains agent work without becoming the primary object.

Files/packages affected: `apps/web`, `apps/api`, shared contracts, demo docs/screenshots, tests.

## M6: Standards-Shaped ToolNet Tools

Status: complete.

Goal: make internal ToolNet/core actions standards-shaped before exposing protocol routes.

Scope: add standards-shaped ToolNet tools for CRD discovery/invocation, DTR questionnaire package, PAS packet build, and guarded PAS mock submit; add mappers/schemas and fixture-level tests.

Out of scope: certified conformance, live payer transport, production SMART/PAS behavior, and unguarded submit.

Exit criteria: standards-shaped tools map to core Use Cases, keep synthetic/non-conformant claim language, and preserve ApprovalGate for submit.

Files/packages affected: `packages/doctor-toolnet`, `packages/prior-auth-core`, `data/standards`, `tests`.

## M7: Standards Gateway HTTP Routes + Tests

Status: complete.

Goal: expose standards-shaped HTTP adapters over ToolNet/core and validate via fixture tests.

Scope: add SMART discovery, CDS services, CRD invocation, FHIR `Questionnaire/$questionnaire-package`, FHIR `Claim/$submit`, OperationOutcome-style errors, and conformance matrix fixture tests.

Out of scope: certification, production payer transport, real EHR integration, and PHI readiness.

Exit criteria: standards gateway routes are explicit adapters, conformance matrix is tested, and docs still state no certification/conformance claim.

Files/packages affected: `apps/api`, `packages/doctor-toolnet`, `data/standards`, `docs/standards`, `tests`.

## M8: Formal Doctor Evals

Status: complete.

Goal: add narrow deterministic regression/safety harness, not eval platform.

Scope: create `packages/doctor-evals`; add scenario registry for MRI happy path, DME happy path, MRI missing evidence, and MRI prompt-injection evidence; add golden trace diffs, tool policy assertions, safety claim checks, JSON/Markdown reports, and `npm run evals`.

Out of scope: LLM judge, model benchmarking, eval dashboard UI, production observability, Langfuse, and OpenTelemetry.

Exit criteria: evals detect unexpected tools, missing approval gates, internal HTTP tool calls, unsafe evidence instructions, and false PHI/conformance/payer submission claims.

Files/packages affected: `packages/doctor-evals`, `packages/doctor-runtime`, `packages/prior-auth-agent-team`, `packages/doctor-toolnet`, `data`, root scripts.

## M9: Production-Path Docs

Status: complete as documentation only.

Goal: document production path without implementing production system.

Scope: create `docs/production-path/` with docs for FHIR data plane, security/authz/audit, EHR/payer integration, deployment/observability, and conformance test path.

Out of scope: Medplum/HAPI implementation, Keycloak/OpenFGA implementation, real SMART App Launch, real payer transport, OpenTelemetry/Langfuse implementation, Kubernetes hardening, and production PHI storage.

Exit criteria: each doc states current OSS posture, production requirement, adapter/interface to build, non-goals, risks/blockers, and sequence prerequisites.

Files/packages affected: `docs/production-path/`.

## Remaining Direction

- Implement Doctor MCP as the external agent interoperability boundary over selected ToolNet tools, resources, and prompts.
- Keep production work docs-only until security, data plane, payer/EHR integration, deployment, observability, and conformance prerequisites are intentionally funded and scoped.
- Keep all current runtime, standards, and eval claims synthetic-only, local-first, non-certified, and non-PHI-ready.
