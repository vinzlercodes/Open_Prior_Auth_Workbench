# M7 Evidence Attachments And DTR Boundary

## Boundary

M7 adds local synthetic evidence attachments, FHIR-shaped DocumentReference/Binary packet entries, fixture-based DTR dependencies, and standards-shaped route aliases. It remains a local developer sandbox. It does not implement real FHIR persistence, Da Vinci conformance, production SMART App Launch, production PAS, X12 278, payer endpoint discovery, or real payer transport.

M8 is the earliest milestone for full CQL behavior, full Bundle-like evidence package product support, real FHIR persistence, Da Vinci conformance, and production SMART/PAS behavior.

## Evidence Model

`EvidenceRepository` is the application-owned evidence boundary. SQLite stores metadata and lifecycle state. Uploaded bytes are written to `.data/evidence-uploads/` by default, or to `OPEN_PRIOR_AUTH_EVIDENCE_UPLOAD_DIR` when set. Bulky file bytes are intentionally not stored in SQLite JSON columns.

Evidence lifecycle states are:

- `available`
- `attached`
- `accepted`
- `removed`
- `included-in-packet`

Packet build includes only accepted evidence. Once a case is packet-ready, submitted, more-info-needed, or terminal, evidence changes are blocked.

## DocumentReference Scope

M7 models four content modes but limits product support deliberately:

- Tiny inline base64 fixture content is implemented for small checked-in examples.
- Local Binary-like resources are the main fixture path.
- Local referenced locations are implemented for JSON/base64 uploads written to the local upload directory.
- Bundle-like evidence packages are represented by one smoke-test fixture only. Full product support is deferred to M8.

Upload validation rejects unsupported MIME types, oversized decoded payloads, malformed base64, missing filenames, and checksum mismatches.

## Packet Behavior

M7 packet builds use schema `m7.local-pas-evidence.v1`. Accepted evidence contributes to an evidence digest in the packet snapshot. Packet IDs remain stable when questionnaire state and accepted evidence metadata/content are unchanged. Packet IDs change when accepted evidence changes.

The packet manifest is non-empty when evidence is accepted. The packet Bundle includes local DocumentReference/Binary-like entries and the Claim supportingInfo references those DocumentReferences.

Older M6 packets with schema `m3.local-pas-style.v1` and empty manifests still load after the v2 SQLite migration.

## DTR Dependencies

The local DTR package now returns fixture Library and ValueSet resources instead of empty dependency arrays. The standards-shaped DTR alias returns explicit non-conformance metadata and a Parameters-shaped response whose Bundle starts with the Questionnaire, includes referenced fixture dependencies, and includes the draft QuestionnaireResponse.

M7 includes a constrained fixture-expression evaluator for named expressions used by the checked-in MRI questionnaire. It is not a general CQL engine. Unsupported expressions return OperationOutcome-style errors.

## Standards Aliases

M7 adds standards-shaped aliases for SMART, CRD, DTR, PAS, and evidence boundary discovery. All aliases return `conformance: false` or equivalent metadata and are labeled `local-non-conformant`.

The aliases are intended to make future replacement boundaries explicit, not to claim standards conformance.

## Verification

Required verification:

```bash
npm test
npm run typecheck
npm run build
```
