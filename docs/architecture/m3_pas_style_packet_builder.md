# M3 PAS-Style Local Packet Builder

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
