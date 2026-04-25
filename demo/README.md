# M4 Demo: Operations Queue and Mock Payer Loop

This demo verifies the M4 implementation of Open Prior Auth Workbench using only synthetic data. It shows the M1 requirement-discovery flow, M2 questionnaire workspace, M3 PAS-style packet builder, and M4 operations layer.

## Demo Data

- Golden scenario: `data/fixtures/golden-scenarios/mri-lumbar-spine.json`
- Synthetic FHIR bundle: `data/seed/mri_lumbar_spine_golden/fhir-bundle.json`
- Payer rule pack: `data/payer-rules/mri-lumbar-spine.acme-health.v1.json`
- Questionnaire fixture: `data/questionnaires/mri-lumbar-spine-prior-auth.2026.04.json`

No real PHI is required or expected.

## Start the Demo

Install dependencies once:

```bash
npm install
```

Run the API:

```bash
npm run dev:api
```

In another terminal, run the web app:

```bash
npm run dev:web
```

Open:

```text
http://localhost:3000
```

## UI Reproduction Steps

1. Click `Seed demo cases` and confirm the operations queue shows multiple synthetic cases.
2. Select a queue row and confirm the selected case details, metrics, operations history, status timeline, and audit trail update.
3. Click `Launch shim`, `Evaluate requirements`, and `Create work item` to run the original single-case flow.
4. Open the form workspace, complete required fields, and click `Mark ready`.
5. Click `Build packet` and confirm the packet shows `preauthorization` Claim use.
6. Click `Submit mock PAS` and confirm the work item status becomes `submitted`.
7. Click `Mark pended` and confirm the queue shows effective status `pended` while the selected case internal status remains `submitted`.
8. Click `Request more info` and confirm the case moves to `more info needed`.
9. Reopen the form workspace, revise evidence, and click `Mark ready`.
10. Build and submit again; the new packet and receipt should differ from the original packet and receipt.
11. Click `Approve`, `Deny`, or `Cancel case` on a submitted case to exercise terminal payer outcomes.
12. For denial, confirm the selected operations history shows a structured denial reason.

## API Reproduction Steps

Read the operations queue:

```bash
curl -s 'http://127.0.0.1:4000/work-items?status=submitted,pended&owner=unassigned&sort=age_desc'
```

Read operations metrics:

```bash
curl -s http://127.0.0.1:4000/operations/metrics
```

Record a payer-pended update:

```bash
curl -s -X POST http://127.0.0.1:4000/work-items/wi-8a673eae6c28/record-payer-status \
  -H 'Content-Type: application/json' \
  -d '{"status":"pended","actor":"mock-payer","message":"Pending nurse review."}'
```

Request more information:

```bash
curl -s -X POST http://127.0.0.1:4000/work-items/wi-8a673eae6c28/request-more-info \
  -H 'Content-Type: application/json' \
  -d '{"message":"Please provide conservative therapy details.","requestedItems":[{"code":"conservative-therapy-duration","label":"Duration of conservative therapy","required":true}],"dueAt":"2026-05-02T00:00:00.000Z"}'
```

Record a structured denial:

```bash
curl -s -X POST http://127.0.0.1:4000/work-items/wi-8a673eae6c28/record-payer-status \
  -H 'Content-Type: application/json' \
  -d '{"status":"denied","actor":"mock-payer","reason":{"code":"insufficient-documentation","display":"Insufficient documentation","detail":"Conservative therapy duration was not documented."}}'
```

Read per-case operations history:

```bash
curl -s http://127.0.0.1:4000/work-items/wi-8a673eae6c28/operations
```

## Verification Commands

```bash
npm test
npm run typecheck
npm run build
```

Expected results:

- `npm test`: M1, M2, M3, and M4 contract tests pass.
- Queue rows derive `effectiveStatus` exactly from latest payer update plus internal work-item status.
- Payer decisions include `submittedAt`, `decidedAt`, and `decisionTimeMs`.
- Stale packets are rejected after QuestionnaireResponse revision changes.
- Terminal approved, denied, and cancelled cases reject further more-info and payer-update attempts.

## M4 Caveats

- Operations metrics are synthetic local metrics, not payer reporting outputs.
- Payer updates are mock-payer events, not real PAS responses or inquiry results.
- The operations queue is in-memory and resets when the API process restarts.
- Audit snapshots include full synthetic local resources for demo/debug visibility. Real-PHI deployments would need payload minimization and redaction before durable audit storage.
