# Production Path

M9 documented what must change before this repository could move from a synthetic local workbench toward a production prior authorization system. It does not implement that system.

Current official references:

- [SMART App Launch v2.2.0](https://hl7.org/fhir/smart-app-launch/)
- [Da Vinci Coverage Requirements Discovery v2.2.1](https://hl7.org/fhir/us/davinci-crd/)
- [Da Vinci Documentation Templates and Rules v2.2.0](https://hl7.org/fhir/us/davinci-dtr/)
- [Da Vinci Prior Authorization Support v2.2.1](https://hl7.org/fhir/us/davinci-pas/)
- [CMS Interoperability and Prior Authorization Final Rule CMS-0057-F](https://www.cms.gov/newsroom/fact-sheets/cms-interoperability-prior-authorization-final-rule-cms-0057-f)
- [FHIR Security](https://hl7.org/fhir/security.html)

## Current OSS Posture

Open Prior Auth Agent Workbench is synthetic-only, local-first, standards-shaped, and explicitly non-conformant. It uses fixture FHIR data, local SQLite state, deterministic ToolNet/runtime paths, local standards gateway aliases, and mock payer behavior.

It is not ready for PHI, has no formal SMART/Da Vinci certification, and is not connected to production EHR or payer endpoints.

## Production Requirement

A production path needs replacement boundaries for real data, auth, audit, EHR and payer exchange, deployment, observability, and conformance testing. CMS-0057-F raises the operating bar for interoperable prior authorization APIs, including support for requirement discovery and prior authorization request/response exchange for impacted payers.

## Adapters / Interfaces To Build

- [FHIR data plane](fhir-data-plane.md): production clinical data, prior-auth state, evidence, and FHIR resource mapping.
- [Security, authorization, and audit](security-authz-audit.md): identity, access policy, secrets, PHI controls, and immutable audit.
- [EHR and payer integration](ehr-payer-integration.md): SMART launch, FHIR access, CRD/DTR/PAS workflows, payer onboarding, and status loops.
- [Deployment and observability](deployment-observability.md): environment separation, managed persistence, jobs, logs, metrics, traces, backups, and incident response.
- [Conformance test path](conformance-test-path.md): version-pinned IG checks, validator execution, negative tests, and partner sandbox evidence.

## Non-Goals

- No Medplum, HAPI, Keycloak, OpenFGA, OpenTelemetry, Langfuse, Kubernetes, or production object-store implementation in M9.
- No SMART launch, real payer transport, production FHIR persistence, or PHI storage in M9.
- No claim of certification, production interoperability, or readiness for production deployment.

## Risks / Blockers

- Standards versions and regulatory expectations can change; docs must pin versions and be reviewed before execution.
- EHR and payer onboarding often depends on organization-specific contracts, security review, sandbox access, and workflow validation.
- FHIR shape compatibility is not enough; production success depends on authorization, operational reliability, semantic mapping, and conformance evidence.

## Sequence Prerequisites

1. Build the FHIR data plane before attaching production auth or external transport.
2. Add security, authorization, audit, secrets, and tenant boundaries before handling PHI.
3. Add EHR and payer integration after data and access-control contracts are stable.
4. Add deployment and observability before pilot traffic.
5. Run conformance and partner sandbox testing before any certification or interoperability claim.
