# M4 Operations Layer

> Pre-agentic baseline note: this document describes the preserved M4 local prior-auth workbench baseline before the Doctor Agent OS roadmap reset. See [../roadmap.md](../roadmap.md) for current M0-M9 direction.

## Boundary

M4 added a local operations layer on top of the M1-M3 CRD-inspired, DTR-inspired, and PAS-style demo flow. At that milestone it was still synthetic-only and in-memory. It did not add Temporal, durable persistence, PAS inquiry, real payer endpoints, or production adjudication.

## Status Model

Internal workflow status remains on `WorkItem.status`. Payer response state is recorded separately on `PayerUpdate.status`.

The queue derives `effectiveStatus` exactly as:

```ts
latestPayerUpdate.status === "pended" && workItem.status === "submitted"
  ? "pended"
  : workItem.status
```

This lets a case appear as payer-pended in the queue while the internal workflow remains `submitted`.

## Transition Rules

The store enforces the internal transition matrix. Important M4 transitions are:

- `review_ready -> packet_ready`
- `packet_ready -> submitted | submission_failed`
- `submitted -> more_info_needed | approved | denied | cancelled`
- `more_info_needed -> review_ready | cancelled`
- `approved`, `denied`, and `cancelled` are terminal

Payer `pended` is not an internal workflow status. It is represented by the latest payer update while the work item remains internally `submitted`.

## Operations Events

M4 introduces first-class operation events for operational history:

- `payer_status_recorded`
- `more_info_requested`
- `more_info_resolved`
- `case_assigned`
- `case_cancelled`

These events complement the status timeline. They do not replace audit events, and they do not overload FHIR resources.

## Metrics

M4 computes metrics from the in-memory work items, status timeline, submission receipts, payer updates, and more-info requests. Provider-side metrics include queue counts, aging buckets, and median time to review-ready.

CMS-aligned synthetic metrics include approval rate, denial rate, pended rate, more-info rate, and average/median time from `submittedAt` to `decidedAt`. These are demo metrics only; they are not payer reporting outputs.

## Packet Freshness

Packet freshness remains a formal invariant:

```ts
packet.snapshot.questionnaireResponseRevision === currentQuestionnaireResponse.revision
```

If evidence changes after packet build, the old packet cannot be submitted. Rebuilding after the revised QuestionnaireResponse creates a new packet ID. Resubmitting the exact same unchanged packet remains idempotent.
