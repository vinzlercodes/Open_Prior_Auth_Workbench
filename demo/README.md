# M2 Demo: MRI Lumbar Spine Form Workspace

This demo verifies the M2 implementation of Open Prior Auth Workbench using only synthetic data. It shows the M1 requirement-discovery flow plus the local DTR-inspired questionnaire package, editable prefills, validation, draft save, and review-ready transition.

## Demo Data

- Golden scenario: `data/fixtures/golden-scenarios/mri-lumbar-spine.json`
- Synthetic FHIR bundle: `data/seed/mri_lumbar_spine_golden/fhir-bundle.json`
- Payer rule pack: `data/payer-rules/mri-lumbar-spine.acme-health.v1.json`
- Questionnaire fixture: `data/questionnaires/mri-lumbar-spine-prior-auth.2026.04.json`
- Missing-evidence scenario for tests: `data/seed/mri_lumbar_spine_missing_evidence/fhir-bundle.json`

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

The API defaults to:

```text
http://127.0.0.1:4000
```

## UI Reproduction Steps

1. Click `Launch shim`.
2. Confirm the patient/order context loads for Elena Rivera.
3. Click `Evaluate requirements`.
4. Confirm the result shows `requirements found` and evaluation ID `eval-8a673eae6c28942c`.
5. Click `Create work item`.
6. Confirm the queue shell shows work item `wi-8a673eae6c28`.
7. Click `Open form workspace`.
8. Confirm the form shows prefilled Patient, Coverage, ServiceRequest, Condition, and Observation fields.
9. Change a prefilled value and confirm the field shows an edited state after saving.
10. Try `Mark ready` before completing required fields and confirm validation blocks review-ready status.
11. Select `Routine` for clinical urgency and `No` for prior lumbar spine surgery.
12. Click `Mark ready` and confirm work item status becomes `review ready` while QuestionnaireResponse status becomes `completed`.

## API Reproduction Steps

Health check:

```bash
curl -s http://127.0.0.1:4000/health
```

Evaluate the golden MRI lumbar spine scenario:

```bash
curl -s -X POST http://127.0.0.1:4000/requirements/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"patientId":"patient-mri-001","coverageId":"coverage-acme-001","requestResourceType":"ServiceRequest","requestResourceId":"servicerequest-mri-lumbar-001","serviceLine":"mri_lumbar_spine","payerId":"acme-health"}'
```

Create a work item from the stored evaluation result:

```bash
curl -s -X POST http://127.0.0.1:4000/work-items \
  -H 'Content-Type: application/json' \
  -d '{"evaluationId":"eval-8a673eae6c28942c","ownerUserId":"demo-operator"}'
```

Open the local DTR-like package:

```bash
curl -s -X POST http://127.0.0.1:4000/dtr/package \
  -H 'Content-Type: application/json' \
  -d '{"workItemId":"wi-8a673eae6c28"}'
```

Expected highlights:

```json
{
  "questionnaireCanonical": "http://openpriorauth.local/fhir/Questionnaire/mri-lumbar-spine-prior-auth|2026.04",
  "questionnaireVersion": "2026.04",
  "dependencies": {
    "libraries": [],
    "valueSets": []
  },
  "questionnaireResponse": {
    "status": "in-progress",
    "subject": {
      "reference": "Patient/patient-mri-001"
    },
    "basedOn": [
      {
        "reference": "ServiceRequest/servicerequest-mri-lumbar-001"
      }
    ]
  }
}
```

Save calls to `/dtr/save-response` must include the current `session.revision` returned by `/dtr/package`.

## Verification Commands

```bash
npm test
npm run typecheck
npm run build
```

Expected results:

- `npm test`: M1 and M2 contract tests pass.
- `npm run typecheck`: API, web, and shared-types workspaces pass.
- `npm run build`: API, web, and shared-types workspaces build successfully.

## M2 Caveats

- This is local DTR-inspired behavior, not a real FHIR `$questionnaire-package` implementation.
- The launch flow remains a SMART-style shim, not production SMART App Launch.
- The FHIR adapter remains fixture-backed for M2 while preserving the Medplum-oriented boundary.
- PAS packet building and submission are reserved for M3.
