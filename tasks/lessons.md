# Lessons

- Keep internal workflow status separate from external payer status. Derived queue states such as payer `pended` should be explicit formulas, not stored as internal `WorkItem.status` values.
- Metrics that depend on time intervals need first-class timestamp fields, not implicit inference from unrelated events. For payer decisions, model `submittedAt`, `decidedAt`, and `decisionTimeMs` directly.
- Do not promote packet or transport bookkeeping into canonical business terms too quickly. In PAS/CDex-style additional-information loops, supporting material may update or support an existing prior authorization request rather than creating a new business request.
- Avoid overloaded healthcare terms when FHIR uses the same word differently. For payer authorization criteria, prefer a precise term such as Prior Authorization Policy over Coverage Policy because Coverage is also a patient insurance resource.
- Avoid using "determination" for pre-submission workbench outputs. In prior authorization language, determination reads like a payer decision; use Requirement Evaluation for local pre-submission evaluation.
