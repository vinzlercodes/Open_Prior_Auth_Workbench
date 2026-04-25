# Demo README M1-M4 Update

## Plan

- [x] Review current demo README, milestone architecture notes, API routes, and UI controls.
- [x] Expand `demo/README.md` with detailed setup, demo data, and milestone walkthroughs for M1 through M4.
- [x] Verify the updated README references real routes, controls, statuses, and fixture paths.

## Review

- Replaced the M4-only demo README with a full M1-M4 demo guide covering setup, synthetic fixture data, UI walkthroughs, API walkthroughs, verification commands, and caveats.
- M1 now documents launch context, deterministic requirement discovery, expected golden evaluation fields, work-item creation, and status timeline checks.
- M2 now documents local DTR-like package creation, prefill provenance, required-field validation, save draft, mark ready, and QuestionnaireResponse/work-item status separation.
- M3 now documents packet build, preauthorization Claim checks, mock PAS submission, idempotency, status timeline, and audit trail checks.
- M4 now documents operations queue seeding, filters, metrics, payer-pended effective status, more-info resolution, resubmission after revised evidence, structured denial, and terminal outcomes.
- `npm test` passed with 38 tests after rerunning with localhost permission for route-level API tests.

# M4 Operations Layer Tracker

## Plan

- [x] Extend shared contracts with operations statuses, payer updates, denial reasons, queue rows, metrics, and operation events.
- [x] Add transition-matrix enforcement for internal workflow and payer status updates.
- [x] Add explicit submittedAt, decidedAt, and decisionTimeMs fields for payer-cycle metrics.
- [x] Add first-class in-memory operations events without overloading the status timeline.
- [x] Add queue listing with effectiveStatus derivation, status/owner filters, aging, and stable sorting.
- [x] Add more-info request, payer-status recording, and work-item operations-history APIs.
- [x] Preserve packet staleness and idempotency invariants after more-info edits and resubmission.
- [x] Add contract tests for queue behavior, transition guards, stale packets, resubmission, terminal guards, and metrics.
- [x] Update the web app into an M4 operations workbench.
- [x] Update README, demo docs, and architecture notes with M4 scope and non-goals.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [x] Run local API/web smoke verification.

## M4 Non-goals

- No production SMART App Launch.
- No real Da Vinci PAS `$submit`, PAS inquiry, or payer endpoint discovery.
- No X12 278 generation or transmission.
- No durable database, Temporal workflow engine, or Medplum-backed persistence.
- No real payer decisions; all payer updates are synthetic mock-payer events.
- No real PHI; synthetic fixtures only.

## Review

- M4 adds operations contracts for `PayerUpdate`, `MoreInfoRequest`, `OperationEvent`, queue rows, structured denial reasons, and operations metrics.
- `WorkItem.status` remains the internal workflow status; payer `pended` is represented only through `PayerUpdate.status`.
- Queue `effectiveStatus` follows the exact rule: latest payer update is `pended` and internal status is `submitted`, otherwise internal status.
- Internal workflow transitions are enforced by the in-memory store and covered by matrix tests.
- Payer decisions record `submittedAt`, `decidedAt`, and `decisionTimeMs`; metrics compute average/median submission-to-decision time plus approval, denial, more-info, and pended rates.
- More-info requests move submitted cases to `more_info_needed`; a valid questionnaire save resolves the open request and returns the case to `review_ready`.
- Packet staleness remains enforced by frozen QuestionnaireResponse revision, and revised evidence creates a new packet and receipt.
- The web app now includes queue filters, metrics, selected-case operations history, mock payer actions, and demo case seeding.
- `npm test` passed with 38 tests after localhost approval for route-level tests.
- `npm run typecheck` passed across API, web, and shared-types workspaces.
- `npm run build` passed across API, web, and shared-types workspaces.
- Local smoke verification passed: API health returned `status: ok`, web returned HTTP 200 on port 3001, demo seeding created cases, and the queue endpoint returned operations rows.
