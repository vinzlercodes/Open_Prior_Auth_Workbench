# M4 Reusable Prior-Auth Domain Proof

M4 proves the prior-auth path is reusable across more than one payer/service line. MRI lumbar spine / Acme Health and DME power wheelchair / Blue Ridge Health use the same core Use Cases, ToolNet tools, runtime agent team, ApprovalGate, queue, packet preview, and trace output.

## Scenarios

| Scenario | Service line | Payer | Request |
| --- | --- | --- | --- |
| MRI Lumbar Spine Authorization | `mri_lumbar_spine` | `acme-health` | `ServiceRequest/servicerequest-mri-lumbar-001` |
| DME Wheelchair Authorization | `dme_power_wheelchair` | `blue-ridge-health` | `DeviceRequest/devicerequest-power-wheelchair-001` |

## UI Steps

1. Run `npm run db:reset`, `npm run dev:api`, and `npm run dev:web`.
2. Open `http://localhost:3000`.
3. Pick either scenario in the sidebar.
4. Run Launch shim, Evaluate requirements, Create work item, Open form workspace.
5. Complete required questionnaire fields, Mark ready, Build packet.
6. Confirm queue, case, requirement result, questionnaire package, evidence list, packet preview, approval boundary, and trace-backed status/audit panels still use the same workflow.

## CLI/API Checks

Seed DME queue rows:

```bash
npm run demo:seed -- 3 dme-power-wheelchair
```

List scenario metadata:

```bash
curl -s "$API_BASE/demo/scenarios" | jq
```

Evaluate DME requirements:

```bash
curl -s "$API_BASE/requirements/evaluate" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "patient-dme-001",
    "coverageId": "coverage-blue-ridge-001",
    "requestResourceType": "DeviceRequest",
    "requestResourceId": "devicerequest-power-wheelchair-001",
    "serviceLine": "dme_power_wheelchair",
    "payerId": "blue-ridge-health"
  }' | jq
```

Expected DME result: `requirements_found`, matched rule `dme-pwc-blue-ridge-001`, rule pack version `2026.05.01`, payer `Blue Ridge Health`, and zero missing data.

## Verification

```bash
npm test
npm run typecheck
npm run build
```
