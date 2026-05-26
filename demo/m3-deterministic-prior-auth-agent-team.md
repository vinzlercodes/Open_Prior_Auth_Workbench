# M3 Deterministic Prior-Auth Agent Team

M3 added a scripted prior-auth agent team in `@open-prior-auth/doctor-runtime`. It uses Runtime + ToolNet only, requires no live LLM, and keeps guarded submit paused for human approval.

## What It Proves

- The deterministic team runs fixed roles in order: orchestrator, requirement discovery, documentation, evidence, packet assembly, and compliance boundary.
- The MRI happy path moves from queue inspection to packet preview.
- Questionnaire save still goes through ApprovalGate, then receives a scripted approval for this deterministic demo path.
- Mock PAS submit creates a pending approval request and leaves the run `waiting_for_human`.
- No submission receipt is created until the final submit approval is handled later.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

Expected result: all tests pass, including the M3 smoke test in `tests/doctor-runtime.contract.test.mjs`.

## Runtime Story

1. `PriorAuthOrchestratorAgent` creates one `AgentRun`.
2. `RequirementDiscoveryAgent` calls queue, case, and requirements tools.
3. `DocumentationAgent` gets the questionnaire package, fills MRI required answers, requests guarded save approval, and applies the scripted approval.
4. `EvidenceAgent` lists evidence.
5. `PacketAssemblyAgent` builds the local PAS-style packet preview.
6. `ComplianceBoundaryAgent` requests guarded mock submit approval and stops.

The ordered runtime trace is the demo artifact. It shows both agent role events and ToolNet tool calls.
