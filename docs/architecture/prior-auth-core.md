# Prior Auth Core

Prior Auth Core is the planned package boundary for provider-side prior authorization Use Cases and ports. It becomes real in M1a; M0 only creates a README placeholder.

## Ownership

Prior Auth Core owns the application actions that describe provider-side prior authorization behavior:

- case read
- work item list
- requirement evaluation
- questionnaire package retrieval
- questionnaire response save
- supporting information list
- submission packet build
- mock submit
- status timeline
- audit trace

## Domain Model

- `PriorAuthorizationCase` is the domain root.
- `WorkItem` is a queue/task projection of a `PriorAuthorizationCase`.
- `PriorAuthorizationCase.lifecycleStatus` is provider-side workflow state only.
- `PriorAuthorizationRequest.requestStatus` is a payer-facing thread phase and excludes final payer outcomes.
- `PayerUpdate` owns non-final payer status messages.
- `PayerDetermination` owns approved, denied, and cancelled outcomes.
- Routine more-info/correction flows use the same `PriorAuthorizationRequest`, a new `SubmissionPacket`, and the same payer tracking thread unless service, payer, coverage, or payer instruction forces a new request.

## Adapter Rule

Use Cases are the source of truth. HTTP routes and ToolNet tools are sibling adapters over Use Cases. ToolNet must not call local HTTP routes to change or inspect case state.

## M1a Boundary

M1a creates the real package manifest/config, adds simple string ID aliases, adds ports, extracts current Use Cases, and keeps current API/UI behavior unchanged.
