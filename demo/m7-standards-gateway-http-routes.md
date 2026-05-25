# M7 Standards Gateway HTTP Routes

M7 exposes local standards-shaped HTTP gateway routes over the synthetic prior authorization sandbox.

These routes are fixture-backed and explicitly non-conformant. They do not provide certified SMART, CDS Hooks CRD, Da Vinci DTR, Da Vinci PAS, X12, live payer transport, live EHR integration, or PHI-ready behavior.

## Routes

- `GET /fhir/.well-known/smart-configuration`
- `GET /cds-services`
- `POST /cds-services/open-prior-auth-order-sign`
- `POST /cds-services/open-prior-auth-appointment-book`
- `POST /cds-services/open-prior-auth-order-dispatch`
- `POST /fhir/Questionnaire/$questionnaire-package`
- `POST /fhir/Claim/$submit`

Legacy local aliases remain available:

- `GET /.well-known/smart-configuration`
- `POST /crd/evaluate`
- `POST /dtr/questionnaire-package`
- `POST /pas/build-submission`
- `POST /pas/submit-local`

## Fixture Inputs

- `data/standards/smart-discovery.local.json`
- `data/standards/crd-order-sign.request.json`
- `data/standards/crd-appointment-book.request.json`
- `data/standards/crd-order-dispatch.request.json`
- `data/standards/dtr-questionnaire-package.parameters.json`
- `data/standards/pas-claim-submit.bundle.json`

## Manual Checks

Run the API:

```bash
npm run dev:api
```

Set the base URL:

```bash
export API_BASE="http://127.0.0.1:4000"
```

Inspect SMART and CDS discovery:

```bash
curl -s "$API_BASE/fhir/.well-known/smart-configuration" | jq
curl -s "$API_BASE/cds-services" | jq
```

Invoke the order-sign CRD fixture:

```bash
curl -s "$API_BASE/cds-services/open-prior-auth-order-sign" \
  -H "Content-Type: application/json" \
  -d @data/standards/crd-order-sign.request.json | jq
```

Expected:

- `conformance: false`
- `productionConformance: false`
- `mode: "local-non-conformant"`
- `cards[0].extension.boundary: "crd"`

The DTR and PAS gateway routes require a matching local work item and packet. Use the contract test for the complete fixture flow.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands pass. In sandboxed runs, tests that bind `127.0.0.1` may need localhost approval.
