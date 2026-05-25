# M6 Standards-Shaped ToolNet Tools

M6 adds standards-shaped sibling tools in Doctor ToolNet while preserving existing runtime and cockpit payloads.

## What Changed

- Runtime/cockpit tools stay stable:
  - `doctor.dtr.get_questionnaire_package`
  - `doctor.pas.build_packet`
  - `doctor.pas.submit_mock`
- Standards-shaped sibling tools add local CRD, DTR, and PAS boundary payloads:
  - `doctor.crd.discover_services`
  - `doctor.crd.invoke_service`
  - `doctor.dtr.get_questionnaire_package_fhir`
  - `doctor.pas.build_claim_submit_bundle`
  - `doctor.pas.submit_claim_fhir_mock`
  - `doctor.pas.map_claim_response_to_runtime_receipt`

## Fixture Inputs

- `data/standards/crd-order-sign.request.json`
- `data/standards/crd-appointment-book.request.json`
- `data/standards/crd-order-dispatch.request.json`
- `data/standards/dtr-questionnaire-package.parameters.json`
- `data/standards/pas-claim-submit.bundle.json`

## Expected Outputs

- CRD discovery returns three local services for `order-sign`, `appointment-book`, and `order-dispatch`.
- CRD invocation returns a CDS Hooks response with a requirement evaluation card.
- DTR standards package returns `Parameters` with a dependency `Bundle` containing `Questionnaire` and `QuestionnaireResponse`.
- PAS build returns a Claim submit `Bundle` containing a `Claim` with `use: "preauthorization"`.
- PAS Claim submit remains guarded and requires Doctor Runtime ApprovalGate.

All standards-shaped outputs include:

- `conformance: false`
- `productionConformance: false`
- `mode: "local-non-conformant"`

## Verification

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands pass. Node may print experimental `node:sqlite` warnings during SQLite-backed runtime tests.
