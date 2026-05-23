# Standards Conformance Matrix

This matrix documents current standards-shaped boundaries. It does not claim certification, production interoperability, or full conformance.

| Area | Current surface | Status | Notes |
| --- | --- | --- | --- |
| SMART App Launch | `GET /.well-known/smart-configuration`, `GET /smart/launch`, `POST /smart/token` | Local non-conformant alias | Boundary marker only; no production SMART launch, authorization server, or EHR integration. |
| CDS Hooks CRD | `POST /crd/evaluate` | CRD-inspired local endpoint | Uses local requirement evaluation; does not implement production CDS Hooks discovery/invocation semantics. |
| Da Vinci DTR | `POST /dtr/package`, `POST /dtr/save-response`, `POST /dtr/questionnaire-package`, `POST /dtr/evaluate-fixture-expression` | DTR-inspired local product surface | Uses fixture Questionnaire/Library/ValueSet dependencies and constrained expression evaluation; no real FHIR `$questionnaire-package` conformance claim. |
| Da Vinci PAS | `POST /pas/build-packet`, `POST /pas/submit`, `POST /pas/build-submission`, `POST /pas/submit-local` | PAS-style local product surface | Builds and submits synthetic packets to mock PAS transport; no Da Vinci PAS `$submit`, X12 278, payer authentication, or payer endpoint discovery. |
| Evidence / Attachments | `GET/POST /work-items/:id/evidence*` | Local synthetic supporting information | Models DocumentReference/Binary-like packet entries for accepted synthetic evidence only. |
| Standards boundary discovery | `GET /standards/boundaries` | Explicit non-conformance metadata | Documents replacement boundaries for future milestones. |

## Roadmap Landing Points

- M6 adds standards-shaped ToolNet tools before protocol routes.
- M7 adds standards gateway HTTP routes and fixture conformance tests.
- M9 documents the production-path requirements for real SMART, CRD, DTR, PAS, security, EHR/payer integration, deployment, observability, and conformance testing.

## Safety Language

All checked-in data is synthetic. This repository is not PHI-ready, not certified for Da Vinci or SMART conformance, and not connected to live EHRs or payers.
