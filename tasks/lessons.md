# Lessons

- Keep internal workflow status separate from external payer status. Derived queue states such as payer `pended` should be explicit formulas, not stored as internal `WorkItem.status` values.
- Metrics that depend on time intervals need first-class timestamp fields, not implicit inference from unrelated events. For payer decisions, model `submittedAt`, `decidedAt`, and `decisionTimeMs` directly.
- Standards-shaped routes should mirror their FHIR operation targets even when local aliases remain; SMART discovery belongs under the FHIR base URL, DTR uses `Questionnaire/$questionnaire-package`, and PAS uses `Claim/$submit`.
- DTR questionnaire package success responses are FHIR `Parameters` with `packagebundle` resources; PAS `Claim/$submit` success responses unwrap the single resource return and respond with a direct Bundle.
- CRD coverage information belongs in CDS Hooks `systemActions`; cards should be reserved for non-coverage explanatory guidance.
