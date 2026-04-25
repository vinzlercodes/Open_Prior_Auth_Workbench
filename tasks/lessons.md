# Lessons

- Keep internal workflow status separate from external payer status. Derived queue states such as payer `pended` should be explicit formulas, not stored as internal `WorkItem.status` values.
- Metrics that depend on time intervals need first-class timestamp fields, not implicit inference from unrelated events. For payer decisions, model `submittedAt`, `decidedAt`, and `decisionTimeMs` directly.
