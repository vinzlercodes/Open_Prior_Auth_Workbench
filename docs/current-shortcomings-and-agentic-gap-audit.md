# Doctor Agent OS / Open Prior Auth Agent Workbench — Detailed Repo Gap Audit

**Prepared for:** Open Prior Auth Workbench / Doctor Agent OS planning  
**Primary source of truth:** `open_prior_auth_workbench_strategy_report.pdf` uploaded in this conversation  
**Repository reviewed:** <https://github.com/vinzlercodes/Open_Prior_Auth_Workbench>  
**Audit stance:** open-source, synthetic-data-only, executive-demo-grade, technically sound agentic software — not big-company production healthcare infrastructure  
**Runtime review status:** Source/documentation architecture audit only. I did not run the app, database migrations, UI, or tests locally.

---

## 1. Executive verdict

The repository has moved in the right direction. It is no longer merely a prior-authorization CRUD/workbench demo. The public README frames the current baseline as **Open Prior Auth Agent Workbench**, a synthetic-data-only provider-side prior authorization application built on a **Doctor Agent OS** substrate. The README says the runnable baseline covers M1–M8 plus M9 production-path documentation, including local MRI lumbar spine and DME power wheelchair flows, requirement discovery, documentation capture, supporting information, PAS-style packet assembly, operations queueing, payer status handling, more-info loops, deterministic agent runs, approval gates, standards-shaped gateway routes, and deterministic evals.

However, judged against the uploaded strategy PDF, the repo is not yet a fully convincing **agentic software system**. It has meaningful agentic infrastructure, but several core agentic boundaries are still thin, scripted, placeholder-level, or too tightly coupled to the current prior-auth demo.

The most accurate current description is:

> **A strong deterministic prior-auth agentic reference implementation, with real runtime/tool/approval/eval scaffolding, but not yet a complete agentic software platform.**

The biggest gap is not that the project lacks features. The biggest gap is that the project’s **agentic claim is ahead of the implementation depth** in four places:

1. **Doctor MCP is not implemented.** The repo itself says `packages/doctor-mcp` is a README-only placeholder and the main unimplemented Doctor Agent OS boundary.
2. **The current agent team is deterministic/scripted.** This is good for demos and evals, but it is not yet a general AgentSpec/AgentRunner/handoff/resume system.
3. **Durable workflow is not a separate execution layer.** There is SQLite persistence and ApprovalGate behavior, but no dedicated workflow/worker layer for long-running case progress.
4. **The API and UI are still closer to a local demo monolith than a modular agentic product surface.** `apps/api/src/server.ts` and `apps/web/app/page.tsx` appear to carry too much product responsibility.

For senior-executive impact, the next phase should make the repo feel like a serious open-source agentic architecture, not only a standards-shaped prior-auth app that displays scripted agent traces.

Recommended positioning:

> **Doctor Agent OS is an open-source, synthetic-only reference architecture for supervised healthcare administrative agents. The current repo proves the core prior-auth workflow with typed tools, deterministic agent traces, approval gates, standards-shaped adapters, SQLite persistence, and evals. The next phase should make the agentic substrate unmistakable: implement MCP, separate workflow execution from HTTP, modularize the cockpit, expand policy/evals, and turn deterministic scripts into a general replayable AgentRunner.**

---

## 2. Source-of-truth expectations from the strategy PDF

The PDF says the project should become **Doctor Agent OS**: an open-source, synthetic-data-only agentic operating system for healthcare administrative workflows, starting with prior authorization as the flagship demo.

It expects the project to build:

- agent runtime
- tool runtime
- MCP server
- workflow engine
- standards-shaped healthcare adapters
- evaluation harness
- agent cockpit
- policy gates
- honest non-production, non-PHI, non-certified boundaries

The PDF’s desired near-term build target is:

> A supervised multi-agent prior authorization case run: intake → requirements → DTR-style documentation → evidence mapping → human approval → PAS-style packet → mock payer response → audit trace.

The actual production north star remains intentionally separate:

- real EHR launch
- payer endpoint discovery
- production FHIR data plane
- real security/authz/audit
- durable workflow execution
- integration pilots
- formal test-kit/conformance path

The important implication: the repo does **not** need to become production healthcare infrastructure now. It does need to soundly address the technical challenges that would matter in a real architecture: modularity, traceability, tool safety, durable workflow, policy, evaluation, scaling boundaries, and honest standards posture.

---

## 3. What is already strong

### 3.1 Strong project identity

The README now has the right broad positioning: **Open Prior Auth Agent Workbench** is the first committed application, and **Doctor Agent OS** is the implementation substrate for runtime, ToolNet tools, approvals, traces, and evaluations.

That is a good separation. Prior authorization remains the wedge. The reusable agent substrate becomes the architectural story.

### 3.2 Strong honesty around safety and conformance

The repo clearly states that it is:

- synthetic-only
- standards-shaped
- non-certified
- not PHI-ready
- not connected to live EHRs or payers
- not production SMART App Launch, CRD, DTR, or PAS
- not a real payer connector

This honesty is a strength. It makes the project credible. Senior stakeholders will generally forgive non-production scope if the boundaries are explicit and technically mature.

### 3.3 Real architectural packages exist

The repo includes several serious package boundaries:

- `packages/prior-auth-core` — provider-side prior-auth use cases and ports
- `packages/doctor-toolnet` — agent-facing tool adapter over Prior Auth Core
- `packages/doctor-runtime` — workflow-agnostic run/task/tool/approval/trace runtime
- `packages/doctor-evals` — deterministic regression and safety harness
- `packages/doctor-mcp` — placeholder for future MCP boundary
- `packages/shared-types` — shared TypeScript contracts

That package map is directionally strong.

### 3.4 ToolNet is a credible concept

`docs/architecture/toolnet.md` says Doctor ToolNet exposes Prior Auth Core use cases with:

- stable tool names
- input/output schemas
- risk levels
- approval metadata
- traceable call records
- deterministic error contracts

It also has the right adapter rule: ToolNet calls use cases directly and must not fetch localhost or bypass Prior Auth Core.

This is exactly the kind of architecture that makes agent systems trustworthy: tools own facts and state changes; agents propose or invoke tools through a controlled layer.

### 3.5 Runtime and ApprovalGate exist

`docs/architecture/runtime.md` says Doctor Runtime owns:

- `AgentRun`
- `AgentTask`
- `TaskPlan`
- `ToolCallRecord`
- `ApprovalRequest`
- `ApprovalDecision`
- `TraceEvent`

It also says guarded ToolNet write/submit tools pause the run, create approval requests, and preserve case state if rejected.

That is a strong start. The project is not merely “AI calls APIs.” It has a real approval and trace vocabulary.

### 3.6 Evals are present

The README says M8 added deterministic Doctor Evals for golden traces, ToolNet policy, ApprovalGate behavior, prompt-injection-as-data checks, and safety claim checks.

That is strategically important. Agentic systems need behavior evaluation, not just endpoint tests.

---

## 4. Major shortcomings

## 4.1 The agentic layer is still deterministic/scripted, not truly runner-driven

### Current state

`docs/architecture/runtime.md` says M3 added a **replayable scripted prior-auth agent team** inside `packages/doctor-runtime`. It has deterministic role classes for orchestration, requirement discovery, documentation, evidence review, packet assembly, and compliance boundary checks.

The documented happy path is ordered:

1. List queue rows.
2. Read the prior authorization case.
3. Re-run requirement evaluation from case context.
4. Get the DTR questionnaire package.
5. Fill remaining scenario questionnaire answers and pause for guarded save approval.
6. Apply a scripted approval for questionnaire save.
7. List evidence.
8. Build PAS-style packet preview.
9. Request guarded mock submit approval and stop at `waiting_for_human`.

This is valuable, but it is still closer to a deterministic scenario runner than a general agent runtime.

### Why it matters

Senior technical reviewers will ask:

> Is the agent doing meaningful work, or is this a workflow script with agent names attached?

The current answer is nuanced:

> It has real agentic scaffolding, but the implemented agent path is deterministic and scripted for safety/evals.

That is defensible, but it should be made architecturally explicit.

### Improvement

Refactor the deterministic team into a first-class runner abstraction:

```ts
export type AgentSpec = {
  name: string;
  role: string;
  instructions: string;
  allowedTools: string[];
  outputSchema: JsonSchema;
  handoffTargets?: string[];
  escalationPolicy?: EscalationPolicy;
};

export type AgentRunner = {
  startRun(input: StartRunInput): Promise<AgentRun>;
  resumeRun(input: ResumeRunInput): Promise<AgentRun>;
  stepRun(input: StepRunInput): Promise<AgentRunStepResult>;
};

export type Planner = {
  createPlan(context: CaseContext): Promise<TaskPlan>;
  nextTask(run: AgentRun): Promise<AgentTask | null>;
};
```

Then keep the current deterministic path as:

```ts
DeterministicPriorAuthReplayPlanner
```

That preserves determinism while proving the runtime is not hardcoded to one flow.

### Recommended repo changes

Add or refactor toward:

```text
packages/doctor-runtime/src/agent-spec.ts
packages/doctor-runtime/src/agent-runner.ts
packages/doctor-runtime/src/planner.ts
packages/doctor-runtime/src/replay-planner.ts
packages/doctor-runtime/src/handoff-router.ts
packages/doctor-runtime/src/run-resumer.ts
packages/doctor-runtime/src/output-validator.ts
```

### Acceptance criteria

- Current scripted MRI/DME paths run through `AgentRunner`.
- Deterministic planner is an implementation detail, not the runtime itself.
- Agent tasks, tool calls, handoffs, and approvals are stored through the same runtime primitives.
- Docs say clearly: “Default demo mode is deterministic replay; architecture supports future live-local planner.”

---

## 4.2 Doctor MCP is still a placeholder

### Current state

The README says MCP remains the next unimplemented interoperability boundary. `docs/architecture/doctor-agent-os.md` says `packages/doctor-mcp` is a README-only placeholder and the main unimplemented Doctor Agent OS boundary.

The strategy PDF, however, treats Doctor MCP as a core part of the target system.

### Why it matters

For an open-source agentic project, MCP is a credibility multiplier. It lets external agent hosts inspect resources, prompts, and safe tools. It also proves that ToolNet is not just an internal implementation detail.

Without MCP, the project is a local workbench with agentic internals. With MCP, it starts to feel like an agent OS.

### Improvement

Implement MCP in the smallest safe form:

```text
apps/mcp-server/
  src/server.ts
  src/toolnet-adapter.ts
  src/resources.ts
  src/prompts.ts
  src/transports/stdio.ts

packages/doctor-mcp/
  src/index.ts
  src/catalog.ts
  src/resource-definitions.ts
  src/prompt-definitions.ts
  src/tool-exposure-policy.ts
```

Expose read-only resources first:

```text
doctor://cases
doctor://cases/{id}
doctor://cases/{id}/audit
doctor://cases/{id}/evidence
doctor://cases/{id}/packet-preview
doctor://evals/scenarios
doctor://evals/golden-traces/{id}
```

Expose read-only tools first:

```text
doctor.case.get
doctor.queue.list_work_items
doctor.evidence.list
doctor.audit.get_trace
doctor.eval.run_scenario
```

Expose prompts:

```text
run_prior_auth_case
find_missing_evidence
summarize_agent_trace
explain_payer_denial
prepare_more_info_response
```

### Do not expose initially

Do **not** expose these through MCP until ApprovalGate and policy checks are wired into MCP execution:

```text
doctor.dtr.save_response
doctor.evidence.attach
doctor.pas.submit_mock
doctor.payer.record_status
```

### Acceptance criteria

- `npm run dev:mcp` starts a local stdio MCP server.
- External MCP-compatible clients can list resources/prompts/tools.
- MCP tools are generated from ToolNet metadata, not duplicated by hand.
- Write/submit tools are absent or return approval-required safely.
- Docs include a “safe MCP exposure first” section.

---

## 4.3 Durable workflow is not yet separated from runtime/API

### Current state

Doctor Runtime persists runs, tasks, approvals, tool call records, and trace events. That is good. But the repo does not yet appear to have a separate `doctor-workflow` package or `apps/worker` that owns long-running progress, retries, timers, signals, and resume semantics.

The strategy PDF expects the workflow layer to own durable progress: long-running case state, timers, retries, and waits.

### Why it matters

Prior authorization is inherently long-running:

- waiting for questionnaire completion
- waiting for missing evidence
- waiting for supervisor approval
- waiting for payer response
- handling more-info loops
- handling denials and appeals
- preserving packet history

A request/response API path is enough for local demo, but not enough as a reference architecture.

### Improvement

Add a lightweight workflow package before introducing any heavy external workflow engine:

```text
packages/doctor-workflow/
  src/workflow-run.ts
  src/checkpoint.ts
  src/signal.ts
  src/human-task.ts
  src/retry-policy.ts
  src/idempotency.ts
  src/workflow-store.ts
  src/resume-run.ts
```

Add a local worker:

```text
apps/worker/
  src/index.ts
  src/prior-auth-worker.ts
```

The worker can be simple. It does not need production queues. It just needs to prove separation:

- API starts a run.
- Worker executes/resumes pending work.
- Approval actions signal the workflow.
- Runs survive process restart.

### Acceptance criteria

- API no longer has to execute full agent runs synchronously.
- Agent run can pause, process can restart, and run can resume from SQLite.
- Approval request and more-info events become workflow signals.
- Docs clearly say SQLite is local-only but uses durable workflow concepts.

---

## 4.4 `apps/api/src/server.ts` is too monolithic

### Current state

The API server appears to own many unrelated concerns: health, SMART metadata, standards boundaries, CRD/CDS routes, launch context, requirement evaluation, work item creation, demo seeding, DTR, PAS, evidence, operations metrics, more-info, payer status, status timeline, audit, runtime store creation, approval summarization, and evidence-board construction.

### Why it matters

This weakens the “reference architecture” story. A senior reviewer will read a very large server file as a local prototype, even if the domain packages are good.

### Improvement

Split API into route modules and presenters:

```text
apps/api/src/
  http/
    createServer.ts
    router.ts
    middleware/
      cors.ts
      errors.ts
      requestValidation.ts
  routes/
    health.ts
    workItems.ts
    requirements.ts
    dtr.ts
    pas.ts
    evidence.ts
    operations.ts
    agentRuns.ts
    approvals.ts
    standardsGateway.ts
    demo.ts
  presenters/
    agentCockpitPresenter.ts
    evidenceBoardPresenter.ts
    packetPreviewPresenter.ts
  services/
    runtimeService.ts
    standardsGatewayService.ts
```

Keep `server.ts` as a composition root only.

### Acceptance criteria

- Each route file owns one API family.
- Presenters convert domain/runtime state to UI-specific view models.
- Standards routes call the standards gateway/service, not inline route logic.
- No evidence matching or packet preview formatting is embedded in generic server plumbing.

---

## 4.5 `apps/web/app/page.tsx` is likely too centralized

### Current state

The web app directory is small: `globals.css`, `layout.tsx`, and `page.tsx`. That is fine for an early demo, but the strategy PDF expects a rich agent cockpit.

### Why it matters

The UI is the executive demo surface. It needs to make agent behavior legible:

- case queue
- case detail
- agent run timeline
- tool viewer
- approval panel
- evidence board
- questionnaire workspace
- packet preview
- payer updates
- audit trace
- eval dashboard
- eventually MCP inspector

If all of that lives in one `page.tsx`, iteration and quality will suffer.

### Improvement

Refactor into cockpit components:

```text
apps/web/app/page.tsx
apps/web/components/case-queue.tsx
apps/web/components/case-summary.tsx
apps/web/components/agent-run-timeline.tsx
apps/web/components/tool-call-viewer.tsx
apps/web/components/approval-panel.tsx
apps/web/components/evidence-board.tsx
apps/web/components/questionnaire-workspace.tsx
apps/web/components/packet-preview.tsx
apps/web/components/payer-updates.tsx
apps/web/components/audit-trace.tsx
apps/web/components/eval-dashboard.tsx
apps/web/lib/api-client.ts
apps/web/lib/view-models.ts
```

### Acceptance criteria

- `page.tsx` becomes layout/composition only.
- Timeline, evidence board, approval panel, and packet preview are reusable components.
- API calls move into a typed client.
- Synthetic-only and non-production banners remain visible.

---

## 4.6 Evidence mapping is too heuristic for the story it needs to tell

### Current state

Evidence support exists. The repo supports synthetic supporting information, DocumentReference/Binary-like packet entries, evidence metadata, and fixture evidence. But the current evidence mapping story appears too shallow: matching requirements to evidence by fixture metadata, titles, filenames, or limited local rules.

### Why it matters

Evidence mapping is one of the most compelling product moments. Executives will understand this immediately:

> “The agent found the PT note and medication history, but flagged that a recent neurologic exam is missing.”

That feature needs strong data modeling and transparent rationale, even if it stays deterministic.

### Improvement

Add a first-class `EvidenceMapping` model:

```ts
export type EvidenceMapping = {
  id: string;
  caseId: string;
  evidenceItemId: string;
  requirementId: string;
  mappingMethod: "fixture-tag" | "rule" | "human" | "llm-draft";
  strength: "strong" | "weak" | "contradictory" | "missing";
  rationale: string;
  citedFields: string[];
  acceptedBy?: string;
  acceptedAt?: string;
  createdAt: string;
};
```

Add deterministic fixture tags:

```json
{
  "evidenceId": "mri-pt-note-001",
  "supportsRequirementIds": ["conservative-therapy-6-weeks"],
  "evidenceStrength": "strong",
  "citedFields": ["therapyDuration", "failedConservativeCare"]
}
```

### Acceptance criteria

- Evidence board is driven by persisted/derived `EvidenceMapping` records.
- Every mapped evidence item has a requirement ID, strength, and rationale.
- Missing evidence is represented explicitly, not inferred only in UI.
- Prompt-injection evidence is handled as data, not instructions.

---

## 4.7 ApprovalGate exists, but approval workflow semantics need more depth

### Current state

ApprovalGate exists and guarded ToolNet tools can pause for approval. This is one of the repo’s strongest areas. But the workflow semantics should become richer if the project wants to feel like an agentic operations system.

### Improvement

Add approval lifecycle states:

```text
requested
viewed
approved
rejected
expired
superseded
executing
executed
execution_failed
```

Add approval detail fields:

```ts
export type ApprovalRequest = {
  id: string;
  runId: string;
  caseId: string;
  requestedByAgent: string;
  toolName: string;
  riskLevel: "write" | "submit" | "external";
  reason: string;
  proposedInput: unknown;
  beforeState?: unknown;
  expectedAfterState?: unknown;
  status: ApprovalStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  rejectionReason?: string;
};
```

### UI improvement

The approval panel should answer:

- What action is proposed?
- Which agent requested it?
- Which tool will execute?
- What data changes?
- What is the before/after preview?
- Why is approval required?
- What happens if rejected?

### Acceptance criteria

- Approval UI shows before/after or proposed side effect.
- Rejections require a reason.
- Rejected approvals leave case state unchanged.
- Approval execution failure is represented distinctly from rejection.

---

## 4.8 Security is intentionally local, but policy should become architecture

### Current state

The repo is honest that it is not PHI-ready and not production-secure. That is correct. However, local-only does not mean policy should remain informal.

The strategy PDF expects a policy layer and ComplianceBoundaryAgent. It also expects checks for synthetic data, tool permissions, approval gates, medical-advice boundaries, standards-claim boundaries, prompt-injection-as-data, and audit completeness.

### Improvement

Add a dedicated policy package:

```text
packages/doctor-policy/
  src/synthetic-data-policy.ts
  src/tool-risk-policy.ts
  src/approval-policy.ts
  src/standards-claim-policy.ts
  src/medical-advice-boundary-policy.ts
  src/prompt-injection-policy.ts
  src/audit-completeness-policy.ts
  src/policy-engine.ts
```

### Policy checks to implement first

```text
- Tool allowed for agent?
- Tool allowed in current execution mode?
- Tool risk level requires approval?
- Tool input schema valid?
- Output makes unsupported production/conformance claims?
- Evidence content is being treated as data rather than instructions?
- Case-changing action has audit actor/correlation ID?
```

### Acceptance criteria

- Every ToolNet execution passes through a policy hook.
- Policy results are stored in the trace.
- Policy failures are visible in the Agent Run Timeline.
- Evals include policy bypass attempts.

---

## 4.9 Standards gateway exists, but standards depth is still mostly “shape”

### Current state

The repo has standards-shaped routes and explicit non-conformance metadata. That is a good posture.

The README correctly says the project does not implement production SMART App Launch, CDS Hooks CRD, FHIR `$questionnaire-package`, Da Vinci DTR, Da Vinci PAS `$submit`, X12 278, payer endpoint discovery, production payer transport, payer adjudication, production-grade durable persistence, real FHIR persistence, or real EHR integration.

### Why it matters

Healthcare executives and technical leaders care about standards literacy. They do not need the OSS demo to be certified, but they will expect precision.

### Improvement

Add machine-readable standards mapping:

```text
docs/standards/conformance-matrix.md
docs/standards/conformance-matrix.json
packages/doctor-standards/src/catalog.ts
```

Each row should include:

```ts
export type StandardsCapability = {
  route: string;
  internalTool: string;
  standardFamily: "SMART" | "CDS Hooks" | "CRD" | "DTR" | "PAS" | "FHIR";
  supportedFixtureFields: string[];
  unsupportedProductionRequirements: string[];
  operationOutcomeBehavior: string;
  testFixturePath: string;
  conformanceClaimAllowed: false;
};
```

### Acceptance criteria

- Standards docs and route metadata cannot drift silently.
- Each standards-shaped route maps to a ToolNet tool or explicit adapter.
- Unsupported production requirements are visible per route.
- Error responses use consistent OperationOutcome-like shapes.

---

## 4.10 Evals are good, but still too narrow for agentic trust

### Current state

Doctor Evals exist and are one of the repo’s strengths. The current baseline includes golden traces, ToolNet policy, ApprovalGate behavior, prompt-injection-as-data checks, and safety claim checks.

### Why it matters

Agent systems need regression tests for behavior, not only unit tests for functions.

### Improvement

Expand evals into these categories:

```text
Golden trace evals
Tool schema evals
Approval bypass evals
Prompt injection evals
Evidence mapping evals
FHIR shape evals
Standards-claim evals
Run resume evals
Malformed payload evals
UI response contract evals
```

### Add scenarios

```text
mri_lumbar_spine_success
mri_missing_neuro_exam
mri_more_info_loop
mri_denial_explain
dme_power_wheelchair_success
specialty_drug_prior_auth
sleep_study_prior_auth
home_oxygen_missing_evidence
prompt_injection_evidence
approval_bypass_attempt
standards_overclaim_output
resume_after_restart
```

### Acceptance criteria

- `npm run evals` prints an executive-readable scorecard.
- CI fails if golden traces drift unexpectedly.
- Each scenario has expected agent plan, tool calls, approvals, final case state, and safety assertions.
- Trace diffs explain what changed.

---

## 5. File and folder audit

## 5.1 Root files

| Path | Current role | Shortcoming | Recommended improvement |
|---|---|---|---|
| `README.md` | Public front door. It explains quickstart, current baseline, safety/conformance boundaries, repo map, API surface, builder docs, and local commands. | Strong but should more clearly separate “implemented deterministic agentic baseline” from “future live-local/MCP agent OS boundary.” | Add one “real vs mocked vs planned” table near the top. Add one architecture diagram. Add direct “agentic maturity” section. |
| `AGENTS.md` | Agent/developer instructions. | Needs stronger architectural guardrails. | Add rules: ToolNet before route duplication; Runtime owns runs; MCP wraps ToolNet; packages cannot import apps; no real PHI; no standards overclaims. |
| `package.json` | Workspace scripts and Node version. Current scripts include build, DB migrate/reset, demo seed, dev API/web, evals, test, and typecheck. | Good baseline. Missing visible lint/format/coverage scripts. | Add `lint`, `format`, `check`, `test:coverage`, `package-boundaries`, `evals:report`. |
| `package-lock.json` | Reproducible npm install. | Fine. | Keep updated; consider Dependabot/Renovate later. |
| `tsconfig.base.json` | Shared TypeScript config. | Could become stricter. | Add strictness if absent: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`. |
| `.env.example` | Local env documentation. | Should cover runtime, MCP, worker, and future policy modes. | Add `OPEN_PRIOR_AUTH_DB_PATH`, `DOCTOR_RUNTIME_DB_PATH`, `NEXT_PUBLIC_API_BASE_URL`, `DOCTOR_MCP_TRANSPORT`, `DOCTOR_EXECUTION_MODE`. |
| `.gitignore` | Local artifact hygiene. | Must keep DBs/uploads/secrets out. | Ensure `.data/`, evidence uploads, local DBs, env files, generated screenshots, and secrets are ignored. |
| `CONTRIBUTING.md` | Contribution guide. | Needs architecture checklist. | Add “agentic change checklist” and “standards claim checklist.” |
| `SECURITY.md` | Security posture/reporting. | Should include local threat model. | Add prompt injection, excessive agency, unsafe MCP exposure, approval bypass, PHI accidental input, and standards overclaiming. |
| `.github/workflows` | CI. | Needs visible eval/lint/coverage posture. | Run build/typecheck/test/evals/lint/package-boundaries and upload eval report artifact. |

---

## 5.2 `apps/api`

Current folder role: local TypeScript API for context lookup, requirement evaluation, questionnaire package, packet building, mock submission, SQLite persistence, evidence, operations APIs, standards-shaped routes, and agent-run endpoints.

### Main shortcomings

1. `server.ts` carries too many responsibilities.
2. Standards routes are co-located with product routes.
3. Agent run execution appears too closely tied to HTTP route flow.
4. Evidence board / packet preview presentation logic should be moved out of the server.
5. Request validation and OperationOutcome-like error handling should be centralized.
6. CORS is suitable for local demo but should be encapsulated and documented as local-only.

### Recommended target structure

```text
apps/api/src/
  index.ts
  http/
    createServer.ts
    router.ts
    middleware/
      cors.ts
      errors.ts
      requestValidation.ts
  routes/
    health.ts
    workItems.ts
    requirements.ts
    dtr.ts
    pas.ts
    evidence.ts
    operations.ts
    agentRuns.ts
    approvals.ts
    standardsGateway.ts
    demo.ts
  presenters/
    agentCockpitPresenter.ts
    evidenceBoardPresenter.ts
    packetPreviewPresenter.ts
  services/
    runtimeService.ts
    priorAuthApplicationService.ts
    standardsGatewayService.ts
```

### Acceptance criteria

- `server.ts` has no domain logic.
- Each route module is testable independently.
- API routes call application services/use cases, not fixture files directly.
- Standards routes map through standards gateway metadata.
- Agent runs are started/resumed, not fully executed synchronously in request handlers.

---

## 5.3 `apps/web`

Current folder role: Next.js workbench UI for the local synthetic demo.

### Main shortcomings

1. `app/page.tsx` is likely too centralized for the Agent Cockpit vision.
2. UI state, API calls, and rendering logic should be separated.
3. Agent timeline should become a first-class cockpit component.
4. Approval panel needs before/after semantics.
5. Eval dashboard and MCP inspector are either missing or future-facing.

### Recommended target structure

```text
apps/web/app/page.tsx
apps/web/components/
  case-queue.tsx
  case-detail.tsx
  case-summary.tsx
  agent-run-timeline.tsx
  tool-call-viewer.tsx
  approval-panel.tsx
  evidence-board.tsx
  questionnaire-workspace.tsx
  packet-preview.tsx
  payer-updates.tsx
  audit-trace.tsx
  eval-dashboard.tsx
  mcp-inspector-placeholder.tsx
apps/web/lib/
  api-client.ts
  view-models.ts
  formatting.ts
  demo-scenarios.ts
```

### Acceptance criteria

- UI has clear panels matching the demo narrative.
- Agent timeline can filter by tool, agent, approval, policy, error.
- Approval panel shows proposed action and risk level.
- Evidence board shows requirement-to-evidence mapping with rationale.
- Eval scorecard is visible from the cockpit or a developer panel.

---

## 5.4 `packages/prior-auth-core`

Current role: provider-side prior authorization use cases and ports.

### Main shortcomings

1. Some evidence, operations, and standards concerns may still be split between API and core.
2. Evidence mapping needs to become a first-class domain concept.
3. Rule-pack versioning and migration should be explicit.
4. Repository contract tests should prove memory/SQLite behavior stays aligned.

### Recommended improvements

Add or strengthen:

```text
src/domain/evidence-mapping.ts
src/domain/requirement-result.ts
src/domain/questionnaire-session.ts
src/domain/submission-packet.ts
src/ports/evidence-mapping-repository.ts
src/ports/rule-pack-repository.ts
src/use-cases/mapEvidenceToRequirements.ts
src/use-cases/checkEvidenceGaps.ts
src/use-cases/validateQuestionnaireResponse.ts
src/use-cases/getOperationsQueueProjection.ts
```

### Acceptance criteria

- Core owns prior-auth business behavior.
- API and ToolNet do not duplicate requirement/evidence/packet logic.
- Evidence gaps are computed by use cases, not UI helpers.
- Rule-pack version appears in requirement runs and audit trace.

---

## 5.5 `packages/doctor-toolnet`

Current role: agent-facing tool registry and contracts over Prior Auth Core.

### Main shortcomings

1. ToolNet is strong but should become the single source for API/MCP/docs metadata.
2. Policy hooks should be explicit.
3. Output schema validation should be first-class, not only input validation.
4. Tool idempotency and side-effect metadata should be explicit.
5. Tool metadata should support standards mapping and MCP exposure.

### Recommended tool metadata

```ts
export type DoctorTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  category: ToolCategory;
  riskLevel: "read" | "draft" | "write" | "submit" | "external";
  requiresApproval: boolean;
  allowedAgents?: string[];
  sideEffect: "none" | "case-state" | "file-write" | "external-call";
  idempotency?: "required" | "recommended" | "not-applicable";
  mcpExposure: "hidden" | "read-only" | "approval-gated";
  standardsMapping?: StandardsMapping;
  handler: ToolHandler;
};
```

### Recommended execution pipeline

```text
agent proposes tool call
→ input schema validation
→ agent/tool allowlist check
→ execution-mode policy check
→ approval check if required
→ tool execution
→ output schema validation
→ trace logging
→ normalized result returned to agent
```

### Acceptance criteria

- All tools publish JSON Schema.
- Tool registry can generate docs and MCP exposure.
- Tool calls always produce traceable call records.
- Guarded tools cannot mutate case state outside Runtime ApprovalGate.

---

## 5.6 `packages/doctor-runtime`

Current role: workflow-agnostic runtime package for agent runs, tasks, approvals, tool call records, and trace events.

### Main shortcomings

1. Current prior-auth agent team is deterministic/scripted.
2. Runtime needs a clearer `AgentRunner` interface.
3. Runtime needs a handoff router and run-resume abstraction.
4. SQLite store needs crash/resume and idempotency tests.
5. Live-local model boundary should exist as an interface, even if no real model is used.

### Recommended structure

```text
packages/doctor-runtime/src/
  agent-spec.ts
  agent-runner.ts
  model-adapter.ts
  planner.ts
  replay-planner.ts
  task-plan.ts
  handoff.ts
  approval-gate.ts
  policy-hooks.ts
  trace-recorder.ts
  output-validator.ts
  run-resumer.ts
  sqliteRuntimeStore.ts
```

### Acceptance criteria

- Deterministic prior-auth team runs through the same `AgentRunner` interface future live-local agents will use.
- Run state machine includes `created`, `planning`, `executing`, `waiting_for_tool`, `waiting_for_human`, `resumed`, `completed`, `blocked`, `failed`, `cancelled`.
- Approval and rejection are trace events.
- Runtime store supports resume after process restart.

---

## 5.7 `packages/doctor-mcp`

Current role: README-only placeholder.

### Main shortcomings

1. No server.
2. No resources.
3. No prompts.
4. No tool exposure.
5. No safety policy for MCP calls.
6. No MCP inspector or demo.

### Recommended implementation phases

#### Phase 1: resources only

```text
doctor://cases
doctor://cases/{id}
doctor://cases/{id}/audit
doctor://cases/{id}/evidence
doctor://cases/{id}/packet-preview
```

#### Phase 2: safe tools

```text
doctor.case.get
doctor.queue.list_work_items
doctor.evidence.list
doctor.audit.get_trace
doctor.eval.run_scenario
```

#### Phase 3: prompts

```text
run_prior_auth_case
find_missing_evidence
summarize_agent_trace
prepare_more_info_response
```

#### Phase 4: approval-gated writes

Only after ApprovalGate and policy are wired:

```text
doctor.dtr.save_response
doctor.evidence.attach
doctor.pas.submit_mock
doctor.payer.record_status
```

### Acceptance criteria

- `apps/mcp-server` exists.
- MCP wraps ToolNet and never duplicates use-case behavior.
- Write tools are hidden or approval-gated.
- README/demo includes MCP invocation instructions.

---

## 5.8 `packages/doctor-evals`

Current role: deterministic regression and safety harness.

### Main shortcomings

1. Needs broader adversarial and failure scenarios.
2. Needs executive-readable scorecards.
3. Needs trace diff artifacts.
4. Needs resume/restart evals.
5. Needs schema drift tests between ToolNet, API, docs, and MCP.

### Recommended eval suite

```text
mri_lumbar_spine_success
mri_missing_neuro_exam
mri_more_info_loop
mri_denial_explain
dme_power_wheelchair_success
specialty_drug_prior_auth
prompt_injection_evidence
approval_bypass_attempt
standards_overclaim_output
malformed_dtr_payload
malformed_pas_payload
resume_after_approval_restart
```

### Recommended scorecard output

```text
Scenario: mri_missing_neuro_exam
Plan: PASS
Tool sequence: PASS
Evidence mapping: PASS
Approval gate: PASS
Final state: PASS
Safety claims: PASS
Trace determinism: PASS
```

### Acceptance criteria

- `npm run evals` produces a deterministic CLI report.
- `npm run evals:report` writes Markdown/HTML artifact.
- CI fails on tool-call order drift unless intentionally updated.
- Prompt-injection evidence cannot alter agent/tool instructions.

---

## 5.9 `packages/shared-types`

Current role: shared TypeScript contracts.

### Main shortcomings

Shared-types can become a dumping ground.

### Improvement

Use explicit namespaces:

```text
packages/shared-types/src/domain/
packages/shared-types/src/api/
packages/shared-types/src/runtime/
packages/shared-types/src/toolnet/
packages/shared-types/src/fhir-like/
packages/shared-types/src/ui/
```

### Acceptance criteria

- UI imports view models, not internal domain/runtime internals.
- ToolNet imports tool contracts, not web/API types.
- Runtime types are reusable outside prior auth.

---

## 5.10 `data`

Current role: synthetic FHIR bundles, golden scenarios, payer rules, questionnaires, evidence fixtures, and standards-shaped payload fixtures.

### Main shortcomings

1. Scenario breadth is still narrow.
2. Evidence fixtures need stronger metadata.
3. Rule packs need versioning.
4. Questionnaire dependency/conditional logic fixtures should expand.
5. Prompt injection and conflicting evidence fixtures should be first-class.

### Recommended additions

```text
data/scenarios/specialty-drug-prior-auth.json
data/scenarios/sleep-study-prior-auth.json
data/scenarios/home-oxygen-prior-auth.json
data/evidence/prompt-injection-note.json
data/evidence/conflicting-evidence-note.json
data/evidence/stale-neurologic-exam.json
data/payer-rules/versions/
data/golden-traces/
```

### Acceptance criteria

- At least three service lines use the same engine.
- Evidence metadata includes requirement tags and source/provenance.
- Rule-pack version appears in audit trace.
- Golden traces are schema-validated.

---

## 5.11 `docs`

Current role: roadmap, glossary, architecture notes, conformance matrix, demo story docs, strategy audit, and production-path documentation.

### Main shortcomings

1. Some docs describe target state and current state in the same voice.
2. MCP docs are necessarily placeholder-level until implementation.
3. Production-path docs can make the project look too ambitious unless clearly scoped.
4. The repo needs a “current shortcomings” document like this one.

### Recommended docs

```text
docs/architecture/current-shortcomings.md
docs/architecture/agent-runner.md
docs/architecture/workflow-semantics.md
docs/architecture/policy-engine.md
docs/architecture/mcp-server.md
docs/evals/scorecard-format.md
docs/demo/executive-demo-script.md
docs/scalability/local-scale-envelope.md
```

### Acceptance criteria

- Every doc has a status badge: `Implemented`, `Partial`, `Planned`, or `Historical`.
- Production-path docs are clearly labeled as future architecture guidance.
- Demo docs tell a crisp business story and a crisp technical story.

---

## 5.12 `tests`

Current role: contract tests for current M1–M8 behavior, standards-shaped gateway routes, package boundaries, runtime approvals, cockpit responses, and eval assertions.

### Main shortcomings

1. Tests should be organized by package and contract level.
2. Coverage reporting is not obvious.
3. Lint/format checks should be added.
4. Package-boundary tests should be explicit and hard to bypass.
5. Load/scale simulation should exist for local SQLite and queues.

### Recommended test layout

```text
tests/unit/
tests/contract/
tests/integration/
tests/evals/
tests/package-boundaries/
tests/local-scale/
```

### Acceptance criteria

- `npm test` remains fast and deterministic.
- `npm run evals` is separate but required in CI.
- Package-boundary test enforces `packages/*` never import `apps/*`.
- Local scale test seeds 100 or 1,000 synthetic cases and checks queue/evidence/timeline response time qualitatively.

---

## 6. Scalability gaps to address without overbuilding

The project does not need Kubernetes, multi-region deployments, enterprise auth, or real payer connectivity to be impressive. It does need a coherent scale path.

| Concern | Current risk | OSS-appropriate fix |
|---|---|---|
| API monolith | Hard to extend and reason about. | Modular route/service split. |
| Request-driven agent execution | Long-running prior-auth work does not fit one HTTP request. | Local worker and persisted checkpoints. |
| SQLite local store | Good for OSS, but concurrency limits should be explicit. | Document local scale envelope and transaction rules. |
| Evidence uploads | File-backed local storage can grow and drift. | Storage interface, checksums, cleanup policy. |
| Agent traces | Trace tables can grow. | Pagination, filtering, export. |
| Queue growth | Demo queues are small. | Cursor pagination and local scale seed. |
| Eval runtime | Small deterministic evals are good but narrow. | Scenario subsets and scorecard artifacts. |
| Observability | Trace/audit exists, but no export path. | Optional OpenTelemetry later, not required now. |

Recommended claim:

> This is not built for production load, but its boundaries are designed so local SQLite can later be swapped for Postgres, request-triggered runs can move to a worker, and deterministic traces can become OpenTelemetry-backed observability.

---

## 7. Highest-priority roadmap

## P0 — must do next

| Priority | Work | Why it matters | Exit criteria |
|---|---|---|---|
| P0.1 | Implement `apps/mcp-server` over ToolNet read tools. | Closes the biggest Doctor Agent OS gap. | External MCP client can discover safe resources/tools. |
| P0.2 | Refactor `apps/api/src/server.ts` into route modules. | Makes architecture credible. | Server becomes composition root only. |
| P0.3 | Add `AgentRunner` abstraction around deterministic agent team. | Makes “agentic” more than a scripted trace. | Deterministic team runs through runner interface. |
| P0.4 | Add workflow checkpoint/resume model. | Shows long-running prior-auth architecture. | Run can pause/restart/resume from SQLite. |
| P0.5 | Refactor `apps/web/app/page.tsx` into cockpit components. | Makes demo polished and extensible. | Timeline, approval, evidence, packet are components. |
| P0.6 | Add eval scorecard artifact. | Makes trust visible. | `npm run evals:report` outputs Markdown/HTML. |

## P1 — strong executive/technical polish

| Priority | Work | Why it matters | Exit criteria |
|---|---|---|---|
| P1.1 | First-class evidence mapping model. | Makes evidence board believable. | Requirement-to-evidence records have rationale/strength. |
| P1.2 | Add `doctor-policy` package. | Turns safety into architecture. | Tool calls record policy checks. |
| P1.3 | Add standards matrix JSON generated from routes/tools. | Makes standards honesty precise. | Docs and route metadata align. |
| P1.4 | Add local role/case permission stub. | Models scalable security without PHI claim. | Local reviewer/specialist roles gate actions. |
| P1.5 | Add 4–6 more golden scenarios. | Proves reusable engine. | More than two service lines or payer outcomes. |
| P1.6 | Add package-boundary tests. | Protects architecture. | CI fails on app imports from packages. |

## P2 — later but valuable

| Priority | Work | Why it matters |
|---|---|---|
| P2.1 | Optional OpenTelemetry trace export. | Improves observability story. |
| P2.2 | Optional model adapter in `live-local` mode. | Shows path from deterministic to real LLM. |
| P2.3 | Synthetic document intelligence sidecar. | Valuable after evidence model stabilizes. |
| P2.4 | Docker Compose for API/web/MCP/worker. | Better OSS onboarding. |
| P2.5 | Postgres adapter path. | Better scalability story without production claim. |

---

## 8. One-page “not fully implemented” list

1. **Doctor MCP** — placeholder only; no actual MCP resources/prompts/tools.
2. **General AgentRunner** — deterministic scripted team exists, but not a full runner/handoff/planner abstraction.
3. **Durable workflow worker** — no separate worker or workflow package yet.
4. **Live-local model adapter** — no real LLM-planning mode; replay/deterministic path dominates.
5. **Policy engine package** — approval exists, but broader policy checks should be first-class.
6. **UI component architecture** — cockpit likely too centralized in `page.tsx`.
7. **API modularity** — `server.ts` carries too many responsibilities.
8. **Evidence mapping** — deterministic but too heuristic; needs mapping records and rationale.
9. **Standards validation depth** — standards-shaped routes exist, but not conformance-level validation.
10. **Synthetic scenario breadth** — two flagship service lines are good but not enough to prove reuse.
11. **Eval breadth** — good initial evals, but needs more adversarial/failure/resume cases.
12. **Authz model** — no local role/case permission model yet.
13. **Observability** — audit/trace exists, but no optional OTel/export path.
14. **Scalability docs/tests** — no clear benchmark or local SQLite scale envelope.
15. **Package taxonomy** — future packages like `doctor-workflow`, `doctor-policy`, `doctor-fhir`, `doctor-evidence`, `doctor-standards` are not split yet.
16. **Deployment story** — local dev is fine, but API/web/MCP/worker compose story is incomplete.
17. **Release hygiene** — no visible published releases; changelog/versioned milestone artifacts should be added.

---

## 9. Recommended executive-facing story after fixes

Use this story:

> Doctor Agent OS is not trying to be a production payer connector today. It is a synthetic, open-source reference system that shows how healthcare administrative agents should be built: typed tools, explicit approval gates, standards-shaped healthcare boundaries, deterministic traces, and evals. Open Prior Auth Agent Workbench is the first proof: a supervised prior-auth agent run that discovers requirements, gathers documentation, maps evidence, builds a PAS-style packet, pauses for human approval, records a mock payer response, and leaves behind an audit trail.

Avoid this story:

> We built a production-ready autonomous prior-auth AI.

Use this claim language:

```text
Agentic, standards-shaped, synthetic-only, approval-gated, traceable, and production-path aware.
```

Do not use:

```text
Production healthcare automation platform.
Certified Da Vinci implementation.
Ready for real PHI.
Live payer submission.
Autonomous clinical decision-maker.
```

---

## 10. Recommended immediate implementation sequence

### Step 1 — Save this audit into the repo

Suggested path:

```text
docs/architecture/current-shortcomings-and-agentic-gap-audit.md
```

### Step 2 — Create a tracking roadmap from the audit

Suggested path:

```text
tasks/agentic-gap-roadmap.md
```

### Step 3 — Implement MCP read-only boundary

Suggested PR:

```text
PR 1: M10 Doctor MCP read-only stdio server
```

### Step 4 — Refactor API and UI

Suggested PRs:

```text
PR 2: API route modularization
PR 3: Agent Cockpit componentization
```

### Step 5 — Generalize runtime

Suggested PR:

```text
PR 4: AgentRunner and deterministic replay planner
```

### Step 6 — Add workflow semantics

Suggested PR:

```text
PR 5: Workflow checkpoints, signals, and local worker
```

### Step 7 — Expand evidence and evals

Suggested PRs:

```text
PR 6: First-class evidence mapping model
PR 7: Expanded Doctor Evals scorecard
```

---

## 11. References

### Project sources

- Open Prior Auth Workbench GitHub repository: <https://github.com/vinzlercodes/Open_Prior_Auth_Workbench>
- README: <https://github.com/vinzlercodes/Open_Prior_Auth_Workbench/blob/main/README.md>
- Doctor Agent OS architecture: <https://github.com/vinzlercodes/Open_Prior_Auth_Workbench/blob/main/docs/architecture/doctor-agent-os.md>
- Doctor Runtime architecture: <https://github.com/vinzlercodes/Open_Prior_Auth_Workbench/blob/main/docs/architecture/runtime.md>
- Doctor ToolNet architecture: <https://github.com/vinzlercodes/Open_Prior_Auth_Workbench/blob/main/docs/architecture/toolnet.md>
- Root package scripts: <https://raw.githubusercontent.com/vinzlercodes/Open_Prior_Auth_Workbench/main/package.json>

### Healthcare standards and agentic-system references

- CMS Interoperability and Prior Authorization Final Rule CMS-0057-F: <https://www.cms.gov/priorities/burden-reduction/overview/interoperability/policies-regulations/cms-interoperability-prior-authorization-final-rule-cms-0057-f>
- HL7 Da Vinci CRD Implementation Guide: <https://build.fhir.org/ig/HL7/davinci-crd/>
- HL7 Da Vinci DTR Implementation Guide: <https://build.fhir.org/ig/HL7/davinci-dtr/>
- HL7 Da Vinci DTR `$questionnaire-package` operation: <https://build.fhir.org/ig/HL7/davinci-dtr/en/OperationDefinition-questionnaire-package.html>
- HL7 Da Vinci PAS Implementation Guide: <https://build.fhir.org/ig/HL7/davinci-pas/>
- SMART App Launch: <https://hl7.org/fhir/smart-app-launch/>
- Model Context Protocol specification: <https://modelcontextprotocol.io/specification/2025-06-18>
- MCP server tools specification: <https://modelcontextprotocol.io/specification/2025-06-18/server/tools>
- OpenAI Agents guide: <https://developers.openai.com/api/docs/guides/agents>
- OpenAI Agents SDK docs: <https://openai.github.io/openai-agents-python/agents/>
- OWASP Top 10 for LLM Applications: <https://owasp.org/www-project-top-10-for-large-language-model-applications/>
- NIST AI Risk Management Framework: Generative AI Profile: <https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence>
- Temporal durable execution: <https://temporal.io/>
- OpenTelemetry: <https://opentelemetry.io/>
