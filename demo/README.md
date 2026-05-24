# Demo Guide: M1 to M7 Open Prior Auth Workbench

This guide walks through every demo piece from M1 through M7 using only synthetic MRI lumbar spine prior authorization data. The current app runs the full M4 workbench, M5 adds OSS-facing documentation, CI, fixture indexing, automation recipes, and deterministic screenshots for external builders, M6 makes local case state survive API restarts through SQLite, and M7 adds local evidence attachments and DTR dependency fixtures. Each milestone remains visible as a separate part of the flow:

- M1: fixture-backed launch context, requirement discovery, and explicit work-item creation.
- M2: local DTR-inspired questionnaire package, prefilled form workspace, validation, and review-ready handoff.
- M3: PAS-style local packet builder, mock PAS submission, status timeline, and audit trail.
- M4: operations queue, filters, metrics, payer updates, more-info loop, structured denial, and terminal outcomes.
- M5: builder-ready docs, fixture index, CI, environment example, sample automations, and reproducible screenshots.
- M6: SQLite-backed local case state, explicit transaction boundaries, and local standards-shaped launch/CRD/DTR/PAS adapters.
- M7: synthetic evidence attachments, DocumentReference/Binary-like packet entries, fixture Library/ValueSet dependencies, and standards-shaped aliases with explicit non-conformance metadata.
- Doctor Runtime M3: deterministic prior-auth agent team over Runtime + ToolNet, ending at guarded submit approval.

No real PHI is required or expected.

## Demo Data

- Golden scenario: `data/fixtures/golden-scenarios/mri-lumbar-spine.json`
- Synthetic FHIR bundle: `data/seed/mri_lumbar_spine_golden/fhir-bundle.json`
- Missing-evidence FHIR bundle: `data/seed/mri_lumbar_spine_missing_evidence/fhir-bundle.json`
- Payer rule pack: `data/payer-rules/mri-lumbar-spine.acme-health.v1.json`
- Questionnaire fixture: `data/questionnaires/mri-lumbar-spine-prior-auth.2026.04.json`
- DTR dependency fixture: `data/questionnaires/mri-lumbar-spine-prior-auth.dependencies.json`
- Evidence fixtures: `data/evidence/mri-lumbar-spine.evidence-fixtures.json`
- Runtime agent team story: `demo/m3-deterministic-prior-auth-agent-team.md`

The canonical golden evaluation is `eval-8a673eae6c28942c`. Creating a work item from that evaluation produces `wi-8a673eae6c28` in a fresh API process.

## Start the Demo

Install dependencies once:

```bash
npm install
```

Initialize or reset the local SQLite demo database:

```bash
npm run db:migrate
```

For a clean demo state:

```bash
npm run db:reset
```

To seed queue rows without clicking through the UI:

```bash
npm run demo:seed
```

Run the API in one terminal:

```bash
npm run dev:api
```

Run the web app in another terminal:

```bash
npm run dev:web
```

Open the app:

```text
http://localhost:3000
```

The API defaults to `http://127.0.0.1:4000`. The API store is SQLite-backed at `.data/open-prior-auth.sqlite`; use `OPEN_PRIOR_AUTH_DB_PATH` to point at another local database file. M7 uploads write synthetic evidence bytes to `.data/evidence-uploads/`; use `OPEN_PRIOR_AUTH_EVIDENCE_UPLOAD_DIR` to point at another ignored local directory. Restarting `npm run dev:api` preserves work items, questionnaire sessions, packets, receipts, evidence metadata, status events, operations history, and audit events. Use `npm run db:reset` when you want a clean demo state.

## M6: Restart Survival Check

M6 proves the local durable case core:

1. Run `npm run db:reset`.
2. Run `npm run dev:api`.
3. Complete M1 through M4 until a case is submitted or pended.
4. Stop the API process.
5. Run `npm run dev:api` again.
6. Reopen the web app and confirm the queue row, status timeline, packet receipt, operations history, and audit trail are still present.

JSON remains the fixture and demo snapshot format. SQLite is the runtime source of truth for local case state.

## M7: Evidence Attachments And Standards Aliases

After creating a work item and opening the form workspace:

1. Click `Refresh evidence`.
2. Attach one or more synthetic evidence fixtures, or upload the local text evidence note.
3. Accept the evidence entries that should be included in the packet.
4. Complete the questionnaire and click `Mark ready`.
5. Click `Build packet`.
6. Confirm the packet panel shows a non-zero attachment count.
7. Confirm the audit trail includes evidence attach, upload, accept, and include-in-packet events.

The standards-shaped aliases can be inspected locally:

```bash
curl -s "$API_BASE/standards/boundaries" | jq
curl -s "$API_BASE/.well-known/smart-configuration" | jq
```

Every standards-shaped alias is local and explicitly non-conformant.

## API Helper Setup

The API examples below assume `jq` is available:

```bash
export API_BASE="http://127.0.0.1:4000"
export GOLDEN_REQUEST='{
  "patientId": "patient-mri-001",
  "coverageId": "coverage-acme-001",
  "requestResourceType": "ServiceRequest",
  "requestResourceId": "servicerequest-mri-lumbar-001",
  "serviceLine": "mri_lumbar_spine",
  "payerId": "acme-health"
}'
```

## M1: Requirement Discovery Sandbox

M1 proves that the app can resolve local patient/order context, run deterministic prior-auth requirement discovery, and create a work item only after the requirement result exists. This is CRD-inspired product behavior, not production SMART App Launch or CDS Hooks CRD conformance.

### M1 UI Steps

1. Click `Launch shim`.
2. Confirm `Patient and order context` fills with the synthetic patient, coverage, MRI lumbar spine request, diagnosis, and conservative-treatment evidence.
3. Click `Evaluate requirements`.
4. Confirm `Requirement evaluation` shows `requirements found`.
5. Confirm the result panel shows:
   - Evaluation ID `eval-8a673eae6c28942c`
   - Matched rule `mri-lspine-acme-001`
   - Next action `create work item`
   - Missing data `0`
6. Click `Create work item`.
7. Confirm `Queue shell` shows work item `wi-8a673eae6c28` with status `requirements found`.
8. Confirm the `Status timeline` now includes the initial `work_item.created` event.

### M1 API Steps

Check the API:

```bash
curl -s "$API_BASE/health" | jq
```

Load patient/order context:

```bash
curl -s "$API_BASE/context/patient/patient-mri-001" | jq
```

Run requirement discovery:

```bash
EVALUATION="$(
  curl -s -X POST "$API_BASE/requirements/evaluate" \
    -H 'Content-Type: application/json' \
    -d "$GOLDEN_REQUEST"
)"
echo "$EVALUATION" | jq
export EVALUATION_ID="$(echo "$EVALUATION" | jq -r '.evaluationId')"
```

Expected checks:

```bash
echo "$EVALUATION" | jq '{
  evaluationId,
  evaluationStatus,
  requiresPriorAuth,
  requiresDocs,
  matchedRuleId,
  rulePackVersion,
  nextAction,
  missingDataCount: (.missingData | length)
}'
```

Expected values are `requirements_found`, `requiresPriorAuth: true`, `requiresDocs: true`, matched rule `mri-lspine-acme-001`, rule pack version `2026.04.23`, next action `create_work_item`, and zero missing data.

Create the work item:

```bash
WORK_ITEM="$(
  curl -s -X POST "$API_BASE/work-items" \
    -H 'Content-Type: application/json' \
    -d "{\"evaluationId\":\"$EVALUATION_ID\",\"ownerUserId\":\"m1-demo-operator\"}"
)"
echo "$WORK_ITEM" | jq
export WORK_ITEM_ID="$(echo "$WORK_ITEM" | jq -r '.id')"
```

Confirm the work item and status timeline:

```bash
curl -s "$API_BASE/work-items/$WORK_ITEM_ID" | jq '{id, evaluationId, status, ownerUserId}'
curl -s "$API_BASE/work-items/$WORK_ITEM_ID/status" | jq
```

## M2: Form Workspace

M2 proves that the local DTR-inspired package returns a Questionnaire, draft QuestionnaireResponse, validation metadata, prefill provenance, dependency slots, and a session revision. The work item status and QuestionnaireResponse status stay separate.

### M2 UI Steps

1. Start from a M1-created work item.
2. Click `Open form workspace`.
3. Confirm the `Form workspace` header shows `MRI Lumbar Spine Prior Authorization`.
4. Confirm prefilled fields show `Prefilled from Patient`, `Coverage`, `ServiceRequest`, `Condition`, or `Observation` badges.
5. Confirm the validation summary reports missing required answers because `Clinical urgency` and `Has the patient had prior lumbar spine surgery?` are not yet complete.
6. Click `Mark ready` without filling the missing fields and confirm validation remains invalid.
7. Set `Clinical urgency` to `Routine`.
8. Set `Has the patient had prior lumbar spine surgery?` to `No`.
9. Confirm `Prior lumbar spine surgery details` stays disabled because the enabling answer is `No`.
10. Click `Save draft` and confirm the session revision increments while the QuestionnaireResponse remains `in-progress`.
11. Click `Mark ready`.
12. Confirm the validation summary changes to `Validation passed`.
13. Confirm `Queue shell` shows work item status `review ready` and QuestionnaireResponse status `completed`.

### M2 API Steps

Create or reuse the M1 `WORK_ITEM_ID`, then request the local DTR-like package:

```bash
PACKAGE="$(
  curl -s -X POST "$API_BASE/dtr/package" \
    -H 'Content-Type: application/json' \
    -d "{\"workItemId\":\"$WORK_ITEM_ID\"}"
)"
echo "$PACKAGE" | jq '{
  workItemId,
  sessionId,
  questionnaireCanonical,
  questionnaireVersion,
  dependencies,
  validation,
  completion,
  session
}'
export REVISION="$(echo "$PACKAGE" | jq -r '.session.revision')"
```

Expected checks:

- `questionnaire.resourceType` is `Questionnaire`.
- `questionnaireResponse.resourceType` is `QuestionnaireResponse`.
- `questionnaireResponse.status` is `in-progress`.
- `dependencies.libraries` and `dependencies.valueSets` are empty arrays.
- `validation.valid` is `false` before the missing required fields are completed.
- `session.revision` starts at `1` on first package creation.

Build a completed QuestionnaireResponse from the package and mark it ready:

```bash
READY_RESPONSE="$(
  echo "$PACKAGE" | jq '.questionnaireResponse
    | .item = (.item | map(
        if .linkId == "clinical-urgency" then
          .answer = [{
            "valueCoding": {
              "system": "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
              "code": "routine",
              "display": "Routine"
            }
          }]
        elif .linkId == "prior-spine-surgery" then
          .answer = [{"valueBoolean": false}]
        else
          .
        end
      ))'
)"

READY_PACKAGE="$(
  jq -n \
    --arg workItemId "$WORK_ITEM_ID" \
    --argjson questionnaireResponse "$READY_RESPONSE" \
    --argjson revision "$REVISION" \
    '{
      workItemId: $workItemId,
      questionnaireResponse: $questionnaireResponse,
      revision: $revision,
      actorUserId: "m2-demo-operator",
      markReadyForReview: true
    }' |
  curl -s -X POST "$API_BASE/dtr/save-response" \
    -H 'Content-Type: application/json' \
    -d @-
)"
echo "$READY_PACKAGE" | jq '{
  validation,
  completion,
  questionnaireResponseStatus: .questionnaireResponse.status,
  sessionStatus: .session.status,
  revision: .session.revision
}'
```

Expected values are `validation.valid: true`, QuestionnaireResponse status `completed`, and session status `review_ready`.

## M3: PAS-Style Packet Builder

M3 proves that a review-ready work item can produce a deterministic PAS-style local packet, freeze the QuestionnaireResponse revision, and submit through mock PAS transport. This is PAS-style local product behavior, not Da Vinci PAS `$submit`, X12 278, endpoint discovery, payer authentication, or real payer adjudication.

### M3 UI Steps

1. Start from a M2 work item with status `review ready`.
2. Click `Build packet`.
3. Confirm `PAS-style local packet` changes to `Packet ready`.
4. Confirm the packet panel shows:
   - Claim use `preauthorization`
   - QR revision matching the completed form session
   - Attachments `0 fixtures`
   - Message `No document fixtures in M3`
5. Confirm `Queue shell` now shows status `packet ready`.
6. Confirm the `Status timeline` includes `review_ready -> packet_ready`.
7. Click `Submit mock PAS`.
8. Confirm the packet panel changes to `Mock PAS submitted`.
9. Confirm the receipt panel shows a `Tracking ID`, transport `mock-pas`, a ClaimResponse ID, and `Idempotent false`.
10. Confirm `Queue shell` now shows status `submitted`.
11. Confirm the `Status timeline` includes `packet_ready -> submitted`.
12. Confirm the `Audit trail` includes work-item, questionnaire-session, submission-packet, and submission-receipt entries.

### M3 API Steps

Build the packet:

```bash
PACKET="$(
  curl -s -X POST "$API_BASE/pas/build-packet" \
    -H 'Content-Type: application/json' \
    -d "{\"workItemId\":\"$WORK_ITEM_ID\",\"actorUserId\":\"m3-demo-operator\"}"
)"
echo "$PACKET" | jq '{
  id,
  workItemId,
  packetSchemaVersion,
  transport,
  snapshot,
  attachmentManifest,
  claimUse: (.bundle.entry[] | select(.resource.resourceType == "Claim") | .resource.use)
}'
export PACKET_ID="$(echo "$PACKET" | jq -r '.id')"
```

Expected values are packet schema version `m3.local-pas-style.v1`, transport `mock-pas`, Claim use `preauthorization`, and zero attachments.

Submit through mock PAS:

```bash
RECEIPT="$(
  curl -s -X POST "$API_BASE/pas/submit" \
    -H 'Content-Type: application/json' \
    -d "{\"packetId\":\"$PACKET_ID\",\"actorUserId\":\"m3-demo-operator\"}"
)"
echo "$RECEIPT" | jq '{
  packetId,
  receiptId,
  trackingId,
  submittedAt,
  transport,
  idempotent,
  claimResponse: (.responseBundle.entry[0].resource)
}'
```

Confirm status and audit evidence:

```bash
curl -s "$API_BASE/work-items/$WORK_ITEM_ID" | jq '{id, status}'
curl -s "$API_BASE/work-items/$WORK_ITEM_ID/status" | jq
curl -s "$API_BASE/work-items/$WORK_ITEM_ID/audit" | jq 'map({sequence, action, resourceType, resourceId, workItemId, packetId, receiptId})'
```

Expected checks:

- Work item status is `submitted`.
- Status timeline includes `review_ready -> packet_ready` and `packet_ready -> submitted`.
- Audit events are sequence ordered and include `submission_packet.built` and `submission_packet.submitted`.
- Submitting the same `PACKET_ID` again returns the same receipt with `idempotent: true`.

## M4: Operations Layer and Mock Payer Loop

M4 proves that submitted cases can be managed through an operations queue with derived payer-pended status, metrics, selected-case operations history, more-info loops, structured denials, and terminal outcomes.

### M4 UI Steps

1. Click `Seed demo cases`.
2. Confirm `Operations queue` shows multiple synthetic cases.
3. Select a queue row.
4. Confirm the selected case updates the `Queue shell`, `Status timeline`, `Audit trail`, and `Selected case operations` panels.
5. In `Status filter`, enter `submitted,pended`.
6. In `Owner filter`, enter `unassigned`.
7. Click `Apply filters` and confirm queue rows match the filters.
8. For a case that is not yet submitted, run the M1-M3 UI path: `Evaluate requirements`, `Create work item`, `Open form workspace`, complete required answers, `Mark ready`, `Build packet`, and `Submit mock PAS`.
9. Click `Mark pended`.
10. Confirm the queue row shows effective status `pended` while the selected case internal status remains `submitted`.
11. Confirm `Selected case operations` shows the latest payer update as `pended`.
12. Click `Request more info`.
13. Confirm the selected case status changes to `more info needed`.
14. Open the form workspace again.
15. Revise evidence, for example update `Conservative treatment evidence`.
16. Click `Mark ready`.
17. Confirm the more-info item is marked resolved and the work item returns to `review ready`.
18. Click `Build packet` and then `Submit mock PAS` again.
19. Confirm the new packet ID and receipt ID differ from the original packet and receipt.
20. On a submitted case, click `Approve`, `Deny`, or `Cancel case`.
21. For `Deny`, confirm `Selected case operations` shows reason `Insufficient documentation` with the detail `Conservative therapy duration was not documented.`
22. Confirm approved, denied, and cancelled cases no longer accept more-info or payer-update actions.

### M4 API Steps

Seed queue cases:

```bash
curl -s -X POST "$API_BASE/demo/seed-work-items" \
  -H 'Content-Type: application/json' \
  -d '{"count":3}' | jq 'map({id, status, ownerUserId})'
```

Read the queue and metrics:

```bash
curl -s "$API_BASE/work-items?status=submitted,pended&owner=unassigned&sort=age_desc" | jq
curl -s "$API_BASE/operations/metrics" | jq
```

Record a payer-pended update on a submitted work item:

```bash
curl -s -X POST "$API_BASE/work-items/$WORK_ITEM_ID/record-payer-status" \
  -H 'Content-Type: application/json' \
  -d '{"status":"pended","actor":"mock-payer","message":"Pending nurse review."}' | jq
```

Confirm the queue derives `effectiveStatus` without mutating the internal status:

```bash
curl -s "$API_BASE/work-items?status=pended" | jq 'map({workItemId, status, effectiveStatus, latestPayerStatus})'
curl -s "$API_BASE/work-items/$WORK_ITEM_ID" | jq '{id, status}'
```

Request more information:

```bash
curl -s -X POST "$API_BASE/work-items/$WORK_ITEM_ID/request-more-info" \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Please provide conservative therapy details.",
    "requestedItems": [
      {
        "code": "conservative-therapy-duration",
        "label": "Duration of conservative therapy",
        "required": true
      }
    ],
    "dueAt": "2026-05-02T00:00:00.000Z",
    "actor": "mock-payer"
  }' | jq
```

Resolve the more-info loop by reopening the package, revising evidence, and marking ready:

```bash
MORE_INFO_PACKAGE="$(
  curl -s -X POST "$API_BASE/dtr/package" \
    -H 'Content-Type: application/json' \
    -d "{\"workItemId\":\"$WORK_ITEM_ID\"}"
)"
MORE_INFO_REVISION="$(echo "$MORE_INFO_PACKAGE" | jq -r '.session.revision')"
REVISED_RESPONSE="$(
  echo "$MORE_INFO_PACKAGE" | jq '.questionnaireResponse
    | .item = (.item | map(
        if .linkId == "conservative-treatment-evidence" then
          .answer = [{"valueString": "Patient completed eight weeks of supervised physical therapy and NSAIDs."}]
        elif .linkId == "clinical-urgency" then
          .answer = [{
            "valueCoding": {
              "system": "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
              "code": "routine",
              "display": "Routine"
            }
          }]
        elif .linkId == "prior-spine-surgery" then
          .answer = [{"valueBoolean": false}]
        else
          .
        end
      ))'
)"

jq -n \
  --arg workItemId "$WORK_ITEM_ID" \
  --argjson questionnaireResponse "$REVISED_RESPONSE" \
  --argjson revision "$MORE_INFO_REVISION" \
  '{
    workItemId: $workItemId,
    questionnaireResponse: $questionnaireResponse,
    revision: $revision,
    actorUserId: "m4-demo-operator",
    markReadyForReview: true
  }' |
curl -s -X POST "$API_BASE/dtr/save-response" \
  -H 'Content-Type: application/json' \
  -d @- | jq '{validation, sessionStatus: .session.status, revision: .session.revision}'
```

Rebuild and resubmit after the revised evidence:

```bash
SECOND_PACKET="$(
  curl -s -X POST "$API_BASE/pas/build-packet" \
    -H 'Content-Type: application/json' \
    -d "{\"workItemId\":\"$WORK_ITEM_ID\",\"actorUserId\":\"m4-demo-operator\"}"
)"
SECOND_PACKET_ID="$(echo "$SECOND_PACKET" | jq -r '.id')"
curl -s -X POST "$API_BASE/pas/submit" \
  -H 'Content-Type: application/json' \
  -d "{\"packetId\":\"$SECOND_PACKET_ID\",\"actorUserId\":\"m4-demo-operator\"}" | jq
```

Record terminal payer outcomes:

```bash
curl -s -X POST "$API_BASE/work-items/$WORK_ITEM_ID/record-payer-status" \
  -H 'Content-Type: application/json' \
  -d '{"status":"approved","actor":"mock-payer","message":"Approved by mock payer."}' | jq
```

For denial, use a submitted case that is not already terminal:

```bash
curl -s -X POST "$API_BASE/work-items/$WORK_ITEM_ID/record-payer-status" \
  -H 'Content-Type: application/json' \
  -d '{
    "status": "denied",
    "actor": "mock-payer",
    "reason": {
      "code": "insufficient-documentation",
      "display": "Insufficient documentation",
      "detail": "Conservative therapy duration was not documented."
    }
  }' | jq
```

Read selected-case operations history:

```bash
curl -s "$API_BASE/work-items/$WORK_ITEM_ID/operations" | jq
```

Expected checks:

- Payer `pended` appears as queue `effectiveStatus` only while internal work item status remains `submitted`.
- More-info request moves the internal status to `more_info_needed`.
- Saving a valid revised QuestionnaireResponse resolves the more-info request and returns status to `review_ready`.
- Revised evidence requires a fresh packet and creates a different packet/receipt pair.
- Approved, denied, and cancelled cases are terminal.
- Denied updates require structured `code`, `display`, and `detail` reason fields.

## M5: OSS Polish Artifacts

M5 proves that an external builder can understand, run, verify, and extend the project without private context. It does not change the runtime behavior from M4.

### M5 Docs To Review

- Root quickstart and milestone map: `README.md`
- Contributor guide: `CONTRIBUTING.md`
- Humble vulnerability reporting guidance: `SECURITY.md`
- Local environment example: `.env.example`
- Fixture index: `data/README.md`
- Architecture note: `docs/architecture/m5_oss_polish.md`
- Docs-only automation recipes: `examples/automations/README.md`
- Screenshot guide: `demo/screenshots/README.md`

### M5 Screenshot Set

Capture the screenshot set from a fresh local API process with only synthetic fixture data. The checked-in M5 screenshots use the Codex in-app browser visible capture surface documented in `demo/screenshots/README.md`; future desktop recaptures should prefer `1440x1100` when that capture surface is available.

- `demo/screenshots/01-launch-shim.png`
- `demo/screenshots/02-requirements-result.png`
- `demo/screenshots/03-dtr-workspace.png`
- `demo/screenshots/04-packet-ready.png`
- `demo/screenshots/05-submitted-pended-queue.png`
- `demo/screenshots/06-more-info-needed.png`
- `demo/screenshots/07-terminal-approved-denied.png`

Expected checks:

- Screenshots show Elena Rivera, Acme Health Plan, and MRI lumbar spine without contrast.
- The requirement result shows the canonical golden evaluation path.
- The DTR workspace shows prefilled fields and visible validation state.
- The packet-ready view shows a local PAS-style packet, not a production PAS submission.
- The pended queue screenshot shows effective payer-pended status while internal status remains submitted.
- The more-info screenshot shows the case re-entering the evidence workflow.
- The terminal screenshot shows approved and denied synthetic outcomes.

## Verification Commands

Run these before calling the demo ready:

```bash
npm test
npm run typecheck
npm run build
```

Expected results:

- `npm test`: M1 through M6 contract tests pass.
- `npm run typecheck`: API, web, and shared-type packages typecheck.
- `npm run build`: API, web, and shared-type packages build.
- Queue rows derive `effectiveStatus` exactly from latest payer update plus internal work-item status.
- Payer decisions include `submittedAt`, `decidedAt`, and `decisionTimeMs`.
- Stale packets are rejected after QuestionnaireResponse revision changes.
- Terminal approved, denied, and cancelled cases reject further more-info and payer-update attempts.

## Caveats

- The launch shim is local and fixture-backed, not production SMART App Launch.
- Requirement discovery is CRD-inspired, not CDS Hooks CRD conformance.
- `/dtr/*` endpoints are local DTR-like product endpoints, not a real FHIR `$questionnaire-package` implementation.
- `/pas/*` endpoints are PAS-style local product endpoints, not Da Vinci PAS `$submit`.
- Payer updates are synthetic mock-payer events, not real PAS responses or inquiry results.
- Operations metrics are synthetic local metrics, not payer reporting outputs.
- The operations queue is backed by local SQLite and survives API restarts. Use `npm run db:reset` for a clean state.
- Audit snapshots include full synthetic local resources for demo/debug visibility. Real-PHI deployments would need payload minimization and redaction before durable audit storage.
