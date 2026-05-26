# FHIR Data Plane

## Current OSS Posture

The current workbench reads synthetic FHIR fixtures from `data/`, stores local workflow state in SQLite, and emits FHIR-shaped payloads for local CRD, DTR, PAS, evidence, and packet flows. These payloads are boundary markers, not production FHIR persistence or formal certification evidence.

The app has useful domain seams already: `ClinicalContextRepository`, `PriorAuthStore`, evidence repositories, packet building, local standards adapters, and deterministic eval fixtures.

## Production Requirement

Production needs a real FHIR R4/R4B data plane or gateway that can read, write, version, validate, and reconcile clinical and administrative resources. The production data plane must support at least Patient, Coverage, Encounter, ServiceRequest, DeviceRequest, Questionnaire, QuestionnaireResponse, DocumentReference, Binary, Claim, ClaimResponse, Provenance, AuditEvent, and terminology dependencies needed by CRD, DTR, and PAS.

FHIR resource mapping must preserve the domain model: `PriorAuthorizationCase` stays the provider-side root, Requirement Evaluation stays local pre-submission reasoning, `PayerUpdate` owns interim payer status, and `PayerDetermination` owns final payer outcomes.

## Adapters / Interfaces To Build

- Production `ClinicalContextRepository` backed by EHR FHIR APIs or an approved clinical data gateway.
- Production `PriorAuthStore` that maps case, request, packet, payer update, payer determination, and queue state to durable storage.
- Production `EvidenceRepository` with metadata in durable storage and bytes in approved object storage or FHIR Binary storage.
- Packet/resource mapper that translates internal prior-auth state to version-pinned FHIR Bundles for DTR/PAS paths.
- Terminology and questionnaire dependency resolver for ValueSet, CodeSystem, Library, Questionnaire, and CQL/SDC assets.
- Provenance writer for generated packets, accepted evidence, questionnaire responses, and payer-facing submissions.

## Non-Goals

- Do not implement Medplum, HAPI FHIR, cloud storage, or a migration here.
- Do not replace current fixtures or local SQLite as part of the docs-only production path.
- Do not claim US Core, Da Vinci, SMART, PAS, or payer-specific conformance based on local FHIR-shaped resources.

## Risks / Blockers

- EHR FHIR APIs may expose partial data, vendor-specific extensions, or institution-specific access limits.
- DTR/PAS mapping can require X12-aware fields and external terminology access not present in this repository.
- Evidence bytes need retention, malware scanning, checksum, size, and access-control policies before production use.
- Resource versioning and retries can duplicate or overwrite prior-auth state without idempotency keys and provenance.

## Sequence Prerequisites

1. Choose version-pinned FHIR, US Core, HRex, CRD, DTR, and PAS package versions.
2. Define canonical mappings from internal prior-auth entities to FHIR resources and back.
3. Add validation fixtures for both happy paths and malformed resource inputs.
4. Add production auth/audit boundaries before connecting this data plane to PHI.
5. Connect EHR and payer adapters only after the data plane has stable resource identity, versioning, and provenance rules.
