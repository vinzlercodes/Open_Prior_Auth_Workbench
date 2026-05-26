# Prior Auth Core

Prior Auth Core is the package boundary for provider-side prior authorization Use Cases and ports. M1a implements it as `@open-prior-auth/prior-auth-core`.

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

M1a created the real package manifest/config, added simple string ID aliases, added ports, extracted current Use Cases, and kept current API/UI behavior unchanged.

Implemented package exports:

- simple string ID aliases for case, request, packet, payer update, payer determination, and work item IDs
- `PriorAuthStore`, `ClinicalContextRepository`, `Clock`, and `IdGenerator` ports
- `PriorAuthorizationCase`, `PriorAuthorizationRequest`, and `PayerDetermination`
- Use Cases for case read, work item list, requirement evaluation, questionnaire package retrieval, questionnaire response save, evidence list, packet build, mock submit, status timeline, and audit trace

`apps/api` still owns concrete HTTP routes, SQLite/memory stores, and fixture FHIR repository adapters. The package does not import `apps/*` and does not rename DB tables. Doctor ToolNet owns agent-facing tool handlers over these Use Cases.
