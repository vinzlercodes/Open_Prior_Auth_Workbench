# Compose Notes

The current workbench intentionally keeps infrastructure light. The API, web app, ToolNet, Runtime, standards gateway, and Doctor Evals run locally over synthetic fixtures and SQLite without self-hosted healthcare infrastructure.

The compose file is for local API/web convenience only. It is not a production deployment, PHI-ready environment, payer gateway, EHR integration, or conformance test harness.

If a production-oriented FHIR data plane becomes useful later, add it behind stable package/application boundaries:

- Patient, coverage, encounter, practitioner, organization, and request lookup stay behind the FHIR repository interface.
- Prior-auth workflow state stays behind `PriorAuthStore` and Runtime store boundaries.
- Requirement evaluation remains deterministic for checked-in synthetic scenarios.
- ToolNet and Runtime must not bypass approval, trace, or package-boundary rules.
