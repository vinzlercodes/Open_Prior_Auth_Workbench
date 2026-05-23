# M1 Standards Sandbox

> Pre-agentic baseline note: this document describes the preserved M1 local prior-auth workbench baseline before the Doctor Agent OS roadmap reset. See [../roadmap.md](../roadmap.md) for current M0-M9 direction.

## Boundaries

M1 keeps the product boundary small:

- The launch shim resolves local patient/order context but is not production SMART App Launch.
- Requirement evaluation is CRD-inspired but does not implement CDS Hooks CRD request/response semantics.
- The FHIR adapter is fixture-backed for local development while keeping Medplum-shaped resource boundaries.
- Work-item creation is explicit and separate from requirement evaluation.

## Future Compatibility Guardrails

- Keep FHIR R4 resources recognizable and portable.
- Keep launch context, resource lookup, and authorization assumptions isolated from business logic.
- Replace the launch shim with a true SMART/CDS Hooks-compatible boundary after the focused M2 form workspace.
- Add Medplum self-hosting when it helps the milestone; fall back to the fixture adapter if infrastructure setup starts to dominate the sprint.
