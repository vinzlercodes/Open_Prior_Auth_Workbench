# M2 Form Workspace Tracker

## Plan
- [x] Review the strategy report and M1 implementation boundaries.
- [x] Confirm M2 scope as a local DTR-inspired form workspace, not real DTR `$questionnaire-package` conformance.
- [x] Add shared M2 questionnaire package, session, validation, prefill, and OperationOutcome-like contracts.
- [x] Add the MRI lumbar spine Questionnaire fixture with stable linkIds, required fields, fixed choices, and enableWhen behavior.
- [x] Implement `/dtr/package` and `/dtr/save-response` with deterministic prefill, editable override metadata, revision checks, validation, and separate work-item versus QuestionnaireResponse status.
- [x] Add contract tests for package shape, save behavior, validation rules, prefill provenance, stale revisions, structured errors, and M1 immutability.
- [x] Update the web app with a local questionnaire adapter, editable prefills, reset-to-prefill, validation messages, save draft, and mark ready for review.
- [x] Update README, architecture notes, and demo docs with M2 scope, non-goals, and verification steps.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.

## M2 Non-goals
- No production SMART App Launch.
- No CDS Hooks / CRD endpoint conformance.
- No real FHIR `$questionnaire-package` operation.
- No CQL execution.
- No adaptive questionnaire `$next-question`.
- No PAS submission.
- No external payer authentication or endpoint discovery.
- No real PHI; synthetic fixtures only.

## Review
- `npm test` passed: 19 total tests covering M1 requirements behavior and M2 questionnaire package/session behavior.
- `npm run typecheck` passed across API, web, and shared-types workspaces.
- `npm run build` passed across API, web, and shared-types workspaces.
- Local dev servers started successfully after approval for localhost binding: API health check returned `status: ok`, and the web app returned HTTP 200 at `http://localhost:3000`.
- M2 adds local DTR-inspired `/dtr/package` and `/dtr/save-response` endpoints, not real FHIR `$questionnaire-package` conformance.
- Work item status and QuestionnaireResponse status are kept separate; prefill overrides are stored in local session metadata outside the FHIR response.
- The form workspace supports editable prefills, reset-to-prefill, validation messages, draft saves, revision-based stale-save protection, and mark-ready behavior.
