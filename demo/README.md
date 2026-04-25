# M3 Demo: MRI Lumbar Spine PAS-Style Local Submission

This demo verifies the M3 implementation of Open Prior Auth Workbench using only synthetic data. It shows the M1 requirement-discovery flow, the M2 local DTR-inspired questionnaire package, and the M3 PAS-style local packet builder with mock PAS submission.

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
13. Click `Build packet`.
14. Confirm the PAS-style local packet panel shows a packet ID, `preauthorization` Claim use, an empty attachment manifest, and work item status `packet ready`.
15. Click `Submit mock PAS`.
16. Confirm the receipt shows a mock tracking ID, a ClaimResponse-like resource, and work item status `submitted`.
17. Confirm the status timeline includes `review ready -> packet ready -> submitted`.

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

Build a PAS-style local packet after marking the questionnaire ready:

```bash
curl -s -X POST http://127.0.0.1:4000/pas/build-packet \
  -H 'Content-Type: application/json' \
  -d '{"workItemId":"wi-8a673eae6c28","actorUserId":"demo-operator"}'
```

Expected highlights:

```json
{
  "transport": "mock-pas",
  "packetSchemaVersion": "m3.local-pas-style.v1",
  "attachmentManifest": {
    "attachments": [],
    "missingFixtureReason": "No document fixtures in M3"
  },
  "snapshot": {
    "payerId": "acme-health"
  }
}
```

Submit the packet through the mock PAS transport:

```bash
curl -s -X POST http://127.0.0.1:4000/pas/submit \
  -H 'Content-Type: application/json' \
  -d '{"packetId":"<packet-id-from-build>","actorUserId":"demo-operator"}'
```

Expected highlights:

```json
{
  "transport": "mock-pas",
  "idempotent": false,
  "responseBundle": {
    "resourceType": "Bundle",
    "entry": [
      {
        "resource": {
          "resourceType": "ClaimResponse",
          "use": "preauthorization"
        }
      }
    ]
  }
}
```

Read the status timeline:

```bash
curl -s http://127.0.0.1:4000/work-items/wi-8a673eae6c28/status
```

## Verification Commands

```bash
npm test
npm run typecheck
npm run build
```

Expected results:

- `npm test`: M1, M2, and M3 contract tests pass.
- `npm run typecheck`: API, web, and shared-types workspaces pass.
- `npm run build`: API, web, and shared-types workspaces build successfully.

## M3 Caveats

- This is local DTR-inspired behavior, not a real FHIR `$questionnaire-package` implementation.
- This is a PAS-style local packet and mock transport, not real Da Vinci PAS `$submit`.
- No X12 278, production PAS transport, payer authentication, endpoint discovery, subscriptions, or payer decisions are implemented.
- The launch flow remains a SMART-style shim, not production SMART App Launch.
- The FHIR adapter remains fixture-backed while preserving the Medplum-oriented boundary.
- Attachments are represented by an intentionally empty manifest until document fixtures are added.
