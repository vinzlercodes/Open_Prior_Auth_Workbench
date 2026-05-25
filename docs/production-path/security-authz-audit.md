# Security, Authorization, And Audit

## Current OSS Posture

The current workbench has local actor IDs, deterministic ApprovalGate behavior, runtime traces, and safety evals. It has no production identity provider, no real OAuth/OIDC flow, no tenant boundary, no PHI controls, no production secret management, and no immutable audit sink.

FHIR Security states that production systems need authenticated users or clients, access-control decisions, TLS for production exchange, and audit records for review and detection.

## Production Requirement

Production must bind every user, agent, tool call, approval, FHIR read/write, packet build, and payer-facing exchange to authenticated identity and authorization context. SMART App Launch and SMART Backend Services are the natural healthcare-facing OAuth patterns, while internal services still need least-privilege credentials, key rotation, and explicit purpose-of-use controls.

Audit must be immutable enough for security review, incident response, payer disputes, and clinical operations. It must record who or what acted, on whose behalf, against which case/resource, with which scopes/policies, at what time, and with what result.

## Adapters / Interfaces To Build

- Identity provider adapter for SMART/OIDC/OAuth user sessions and backend service clients.
- Policy decision adapter for RBAC/ABAC, tenant checks, purpose-of-use, case assignment, and tool risk levels.
- Approval actor binding that proves human approval came from an authorized user with relevant case access.
- Secret provider for client credentials, signing keys, payer/EHR sandbox credentials, and rotation metadata.
- Audit sink adapter that writes append-only security, clinical, ToolNet, ApprovalGate, and standards-gateway events.
- Token/scope introspection path for FHIR resource access and ToolNet execution.

## Non-Goals

- Do not implement Keycloak, OpenFGA, SMART launch, backend services, or secret rotation in M9.
- Do not treat local actor strings or deterministic traces as production authentication.
- Do not store or process PHI until security, audit, tenant, and operational controls are implemented and reviewed.

## Risks / Blockers

- Agent tool execution can amplify overbroad scopes unless tools enforce policy at call time.
- Shared service accounts can erase accountability if approval and audit events are not bound to a real actor.
- Logs and traces can leak PHI unless redaction, retention, and access policy are designed before production traffic.
- Cross-tenant data leakage is a critical blocker for any hosted deployment.

## Sequence Prerequisites

1. Define threat model, protected assets, trust boundaries, and tenant model.
2. Pick identity and policy architecture before adding live EHR or payer credentials.
3. Define audit event schema and retention policy before processing PHI-like data.
4. Gate every write/submit ToolNet path through policy and approval actor binding.
5. Run security and privacy review before any pilot deployment.
