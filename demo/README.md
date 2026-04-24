# M1 Demo: MRI Lumbar Spine Requirements Sandbox

This demo verifies the M1 implementation of Open Prior Auth Workbench using only synthetic data. It shows the CRD-inspired requirement evaluation flow, explicit work-item creation from a stored `evaluationId`, and the SMART-style launch shim UI.

## Demo Data

- Golden scenario: `data/fixtures/golden-scenarios/mri-lumbar-spine.json`
- Synthetic FHIR bundle: `data/seed/mri_lumbar_spine_golden/fhir-bundle.json`
- Payer rule pack: `data/payer-rules/mri-lumbar-spine.acme-health.v1.json`
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
6. Confirm the queue shell shows work item `wi-8a673eae6c28` and references the same evaluation ID.

## API Reproduction Steps

Health check:

```bash
curl -s http://127.0.0.1:4000/health
```

Expected output:

```json
{
  "service": "open-prior-auth-api",
  "status": "ok",
  "mode": "m1-fixture-backed-medplum-boundary"
}
```

Evaluate the golden MRI lumbar spine scenario:

```bash
curl -s -X POST http://127.0.0.1:4000/requirements/evaluate \
  -H 'Content-Type: application/json' \
  -d '{"patientId":"patient-mri-001","coverageId":"coverage-acme-001","requestResourceType":"ServiceRequest","requestResourceId":"servicerequest-mri-lumbar-001","serviceLine":"mri_lumbar_spine","payerId":"acme-health"}'
```

Expected highlights:

```json
{
  "evaluationId": "eval-8a673eae6c28942c",
  "evaluationStatus": "requirements_found",
  "requiresPriorAuth": true,
  "requiresDocs": true,
  "matchedRuleId": "mri-lspine-acme-001",
  "nextAction": "create_work_item",
  "missingData": []
}
```

Create a work item from the stored evaluation result:

```bash
curl -s -X POST http://127.0.0.1:4000/work-items \
  -H 'Content-Type: application/json' \
  -d '{"evaluationId":"eval-8a673eae6c28942c","ownerUserId":"demo-operator"}'
```

Expected highlights:

```json
{
  "id": "wi-8a673eae6c28",
  "evaluationId": "eval-8a673eae6c28942c",
  "status": "requirements_found",
  "ownerUserId": "demo-operator"
}
```

## Verification Commands

```bash
npm test
npm run typecheck
npm run build
```

Expected results:

- `npm test`: 5 passing tests.
- `npm run typecheck`: API, web, and shared-types workspaces pass.
- `npm run build`: API, web, and shared-types workspaces build successfully.

## M1 Caveats

- This is CRD-inspired, not a CDS Hooks CRD implementation.
- The launch flow is a SMART-style shim, not production SMART App Launch.
- The FHIR adapter is fixture-backed for M1 while preserving the Medplum-oriented boundary.
- The M2 boundary is to replace the launch shim with a true SMART/CDS Hooks-compatible boundary.
