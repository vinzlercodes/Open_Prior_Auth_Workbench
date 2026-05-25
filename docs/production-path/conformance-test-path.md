# Conformance Test Path

## Current OSS Posture

The current repo has contract tests, standards-shaped fixtures, and deterministic doctor evals. These prove local behavior, safety language, ToolNet policy, ApprovalGate behavior, and fixture payload shape. They do not prove official SMART, CRD, DTR, PAS, US Core, HRex, SDC, CQL, FHIR, payer, or EHR conformance.

The conformance matrix is intentionally labeled as standards-shaped and non-conformant.

## Production Requirement

Production needs a version-pinned conformance strategy for each target implementation guide and partner workflow. The test path must include official FHIR validation where applicable, IG package versions, positive and negative cases, partner sandbox tests, security tests, operational tests, and clear language distinguishing internal readiness from certification.

The likely version targets at M9 planning time are SMART App Launch v2.2.0, Da Vinci CRD v2.2.1, DTR v2.2.0, PAS v2.2.1, FHIR R4/R4B, and CMS-0057-F prior authorization API expectations. These must be rechecked before execution.

## Adapters / Interfaces To Build

- Conformance fixture harness that can run local and partner payloads against version-pinned IG expectations.
- Validator runner for FHIR resources and Bundles, including configured IG packages and terminology dependencies.
- Negative test suite for malformed hooks, missing scopes, missing required resources, invalid questionnaires, duplicate submission, status mismatch, and unsafe additional-information flows.
- Partner sandbox harness for EHR launch, FHIR reads, CRD cards, DTR package retrieval, PAS submission, status, update, cancel, and more-information loops.
- Evidence/report artifact store for validation output, partner sandbox logs, test data provenance, exceptions, and sign-off records.

## Non-Goals

- Do not claim certification, official validation, or production interoperability from current tests.
- Do not add external validator tooling, partner sandbox calls, or CI changes in M9.
- Do not treat synthetic fixture success as legal, regulatory, payer, or EHR acceptance.

## Risks / Blockers

- Official IG versions can change, and partner sandboxes may lag or customize behavior.
- Terminology validation can fail without licensed or remote terminology services.
- Passing FHIR validation does not prove clinical workflow fit, payer policy correctness, or operational reliability.
- Certification and regulatory claims need legal/compliance review, not engineering test output alone.

## Sequence Prerequisites

1. Pin standards versions and record why each version is targeted.
2. Build production data, security, EHR/payer, and deployment boundaries first enough to test real workflows.
3. Add official validator execution and retain machine-readable results.
4. Add partner-specific sandbox suites and record deviations.
5. Update public docs only after validation evidence supports any stronger conformance language.
