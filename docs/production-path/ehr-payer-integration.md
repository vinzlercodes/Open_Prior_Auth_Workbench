# EHR And Payer Integration

## Current OSS Posture

The current API exposes local standards-shaped aliases for SMART discovery, CRD, DTR, PAS, evidence, and status paths. These aliases return explicit non-conformance metadata and use fixtures, local Requirement Evaluation, local packet builds, and mock payer behavior.

There is no production SMART App Launch, no production EHR data access, no payer endpoint discovery, no real PAS transport, no X12 278/275 handling, and no external status polling.

## Production Requirement

Production integration must support EHR launch and data access, CRD requirement discovery, DTR questionnaire/package workflows, PAS prior authorization request/response exchange, payer onboarding, status updates, additional-information loops, retry behavior, and idempotent submission. CMS-0057-F requires impacted payers to support prior authorization APIs that can identify documentation requirements and communicate approvals, denials with reasons, and more-information requests.

The provider-side domain model must stay stable across external workflows: Requirement Evaluation is pre-submission reasoning, `PayerUpdate` records interim payer messages, and `PayerDetermination` records final payer outcomes.

## Adapters / Interfaces To Build

- EHR FHIR client for SMART launch context, resource reads, and writeback paths allowed by the EHR contract.
- Payer discovery and onboarding adapter for endpoint metadata, auth credentials, supported IG versions, service lines, and sandbox/prod separation.
- CRD client/server boundary that maps CDS Hooks requests/responses to local Requirement Evaluation without overstating conformance.
- DTR service boundary for `Questionnaire/$questionnaire-package`, SDC/CQL dependencies, prefill, validation, and persisted QuestionnaireResponse state.
- PAS transport and status adapter for Claim submission, ClaimResponse handling, retry/idempotency, more-information loops, update, cancel, and status inquiry.
- Partner sandbox harness for each EHR/payer combination before any production traffic.

## Non-Goals

- Do not implement SMART launch, EHR API clients, payer transport, X12 mapping, or endpoint onboarding as part of the docs-only production path.
- Do not replace local standards aliases with production endpoints as part of the docs-only production path.
- Do not claim production EHR connectivity, production payer exchange, or Da Vinci certification.

## Risks / Blockers

- EHR launch, scopes, and available resources vary by vendor, institution, app registration, and user role.
- Payer endpoint behavior and supported IG versions may vary even when payloads are FHIR-shaped.
- PAS and X12 mapping can require licensed implementation guidance and operational clearinghouse workflows.
- Retrying submissions without idempotency can duplicate requests or corrupt payer tracking state.

## Sequence Prerequisites

1. Finish production FHIR data plane and security/authz/audit boundaries.
2. Pick version-pinned CRD, DTR, PAS, SMART, US Core, and HRex targets.
3. Define onboarding records for EHRs, payers, service lines, endpoint URLs, auth modes, and supported workflows.
4. Prove each partner path in sandbox with synthetic patients before pilot traffic.
5. Add deployment observability and incident runbooks before production endpoint access.
