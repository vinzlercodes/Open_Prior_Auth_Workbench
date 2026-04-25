# M3 PAS-Style Local Packet Builder Tracker

## M3 Audit Trail Gap Plan

- [x] Add shared audit event contract with monotonic sequence, stable event ID, and `beforeJson` / `afterJson` snapshots.
- [x] Update the in-memory store to capture full resource snapshots and work-item linkage.
- [x] Add work-item scoped audit API coverage for linked questionnaire, packet, receipt, and work-item events.
- [x] Add compact web demo audit summary without rendering full JSON payloads.
- [x] Document synthetic-only full audit snapshot posture.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.

## Plan

- [x] Review the strategy report roadmap, M2 implementation, and M3 plan refinements.
- [x] Extend shared contracts with packet, receipt, status event, and M3 work item statuses.
- [x] Implement deterministic PAS-style local packet build with `Claim.use = "preauthorization"`.
- [x] Add mock PAS submission that returns a response Bundle with a ClaimResponse-like resource.
- [x] Record status events and audit-backed transitions for `review_ready`, `packet_ready`, and `submitted`.
- [x] Reject stale packet submission when QuestionnaireResponse revision changes after packet build.
- [x] Add contract tests for packet build, submit, idempotency, stale packets, empty attachment manifest, and timeline fields.
- [x] Update the web demo with build packet, submit mock PAS, receipt summary, and status timeline.
- [x] Update README, architecture notes, and demo docs with M3 scope and non-goals.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.

## M3 Non-goals

- No real Da Vinci PAS `$submit`.
- No X12 278 generation or transmission.
- No production PAS transport.
- No payer authentication or endpoint discovery.
- No payer decisions or adjudication.
- No subscriptions or durable workflow engine.
- No real PHI; synthetic fixtures only.
- No document attachments beyond the empty M3 manifest.

## Review

- M3 audit gap fix adds `GET /work-items/:id/audit` with sequence-ordered events and `beforeJson` / `afterJson` snapshots mapped to the strategy report's `before_json` / `after_json` fields.
- Audit linkage now returns work-item, questionnaire session, submission packet, and submission receipt events for a work item even when the event resource ID differs from the work item ID.
- The web demo shows compact audit metadata only: action, actor, resource, time, and before/after capture status.
- Full audit snapshots are documented as synthetic-data-only; real-PHI usage would require minimization and redaction.
- `npm test` passed after localhost approval for the route-level audit endpoint test: 28 total tests.
- `npm run typecheck` passed across API, web, and shared-types workspaces.
- `npm run build` passed across API, web, and shared-types workspaces.
- Local dev servers started for the audit update: API health check returned `status: ok` at `http://127.0.0.1:4000`, and the web app returned HTTP 200 at `http://127.0.0.1:3001`.
- `npm test` passed: 24 total tests covering M1 requirements behavior, M2 questionnaire package/session behavior, and M3 packet/submit behavior.
- `npm run typecheck` passed across API, web, and shared-types workspaces.
- `npm run build` passed across API, web, and shared-types workspaces.
- M3 adds PAS-style local `/pas/build-packet` and `/pas/submit` endpoints, not real Da Vinci PAS `$submit` or X12 transport.
- Successful packet build moves the work item to `packet_ready`; successful mock submit moves it to `submitted`.
- Mock submission returns a receipt with `transport: "mock-pas"` and a response Bundle containing a ClaimResponse-like resource.
- Local dev servers started successfully after approval for localhost binding: API health check returned `status: ok`, and the web app returned HTTP 200 at `http://localhost:3001`.
- Browser demo verification reached submitted status after launch, requirement evaluation, work-item creation, form completion, mark ready, packet build, and mock PAS submit.
