# M3 PAS-Style Local Packet Builder

> Pre-agentic baseline note: this document describes the preserved M3 local prior-auth workbench baseline before the Doctor Agent OS roadmap reset. See [../roadmap.md](../roadmap.md) for current M0-M9 direction.

## Boundary

M3 adds a PAS-style local packet builder and mock transport on top of the M1 requirements sandbox and M2 form workspace. It preserves PAS vocabulary and the mental model of one request Bundle returning one response Bundle, but it does not implement Da Vinci PAS `$submit`, X12 278, payer authentication, endpoint discovery, or real payer decisions.

The local packet includes:

- request context resources from the synthetic FHIR bundle
- completed QuestionnaireResponse from the M2 session
- one local Claim resource with `use: "preauthorization"`
- empty attachment manifest with `attachments: []`
- `missingFixtureReason: "No document fixtures in M3"`

## Lifecycle Rules

- Packet build is allowed after the work item reaches `review_ready`.
- Successful build moves the work item from `review_ready` to `packet_ready`.
- Packet build freezes work item ID, QuestionnaireResponse ID, QuestionnaireResponse revision, payer ID, and packet schema version.
- Submitting a stale packet fails when the current QuestionnaireResponse revision differs from the frozen packet revision.
- Successful mock submission moves the work item from `packet_ready` to `submitted`.
- Rebuilding an unchanged packet and re-submitting an already submitted packet are idempotent.

## Mock PAS Response

The mock transport returns a `SubmissionReceipt` with `transport: "mock-pas"`, a deterministic tracking ID, and a response Bundle containing one ClaimResponse-like resource. This keeps the demo close to the PAS response-resource model without claiming standards conformance.

## Status Timeline

Status events record `eventId`, `workItemId`, `fromStatus`, `toStatus`, `actor`, `at`, `causedBy`, `packetId`, and `receiptId`. The timeline is app-owned workflow state and remains separate from FHIR resources.

## Audit Trail

M3 exposes `GET /work-items/:id/audit` for a work-item scoped audit trail. Audit events use a monotonic `sequence` and stable `eventId` so consumers can sort by creation order instead of timestamp alone.

Audit events record `actor`, `action`, `resourceType`, `resourceId`, `timestamp`, and resource snapshots in `beforeJson` and `afterJson`, corresponding to the strategy report's `before_json` and `after_json` table fields. Every work-item-related audit event writes `workItemId` when the event is created, so the read API can filter directly on that linkage field. Work-item status events capture the full previous and updated `WorkItem`, not only the changed status. Linked questionnaire session, packet, and receipt events are returned with the work item even when their own `resourceId` is not the work item ID.

Unchanged idempotent operations do not create duplicate saved audit records. If a packet is reused while moving workflow state forward, the marker is named explicitly as `submission_packet.reused`.

Full audit snapshots are acceptable for this M3 demo because the repository uses synthetic data only. A real-PHI implementation would need a minimization and redaction policy before persisting audit payloads.
