# Synthetic Fixture Index

All data in this directory is synthetic and safe for local demos. Do not add real PHI, payer credentials, production EHR URLs, production payer endpoints, or customer-specific configuration.

## Files

- `fixtures/golden-scenarios/mri-lumbar-spine.json`: Golden scenario metadata and request shape for the MRI lumbar spine prior authorization demo.
- `seed/mri_lumbar_spine_golden/fhir-bundle.json`: Synthetic FHIR R4 bundle with enough evidence for deterministic requirement discovery and prefill.
- `seed/mri_lumbar_spine_missing_evidence/fhir-bundle.json`: Synthetic FHIR R4 bundle used to prove missing baseline evidence behavior.
- `payer-rules/mri-lumbar-spine.acme-health.v1.json`: Local payer rule pack for Acme Health MRI lumbar spine requirements.
- `questionnaires/mri-lumbar-spine-prior-auth.2026.04.json`: Local Questionnaire fixture used by the DTR-inspired form workspace.

## Deterministic IDs

- Patient: `patient-mri-001`
- Coverage: `coverage-acme-001`
- ServiceRequest: `servicerequest-mri-lumbar-001`
- Payer: `acme-health`
- Service line: `mri_lumbar_spine`
- Golden evaluation: `eval-8a673eae6c28942c`
- Fresh-process golden work item: `wi-8a673eae6c28`
- Matched rule: `mri-lspine-acme-001`
- Rule pack version: `2026.04.23`
- Questionnaire canonical: `http://openpriorauth.local/fhir/Questionnaire/mri-lumbar-spine-prior-auth|2026.04`

## Safe Modification Patterns

- Create a new fixture file instead of overwriting the golden scenario when testing a different clinical path.
- Keep new service-line names explicit and lowercase snake_case.
- Add tests when changing deterministic IDs, rule matching, required questionnaire fields, or packet shape.
- Update `demo/README.md` and screenshot docs when fixture changes affect visible demo steps.
- Keep payer names, patient names, organizations, identifiers, dates, and notes synthetic.

## What Not To Add

- Real patient records or screenshots.
- Real payer policies copied from non-public sources.
- Production payer or EHR endpoint URLs.
- Access tokens, API keys, private keys, or credentials.
- Customer-specific implementation details.
