# Prior Auth Core

Provider-side prior authorization Use Case and ports package for Doctor Agent OS.

M1a made this a real workspace package. HTTP routes in `apps/api` and Doctor ToolNet tools are sibling adapters over these Use Cases.

## Boundary

- Owns Prior Authorization Case Use Cases.
- Does not import `apps/*`.
- Exposes ports for clinical context, store, clock, and ID generation.
- Keeps `PriorAuthorizationCase` as domain root.
- Keeps `WorkItem` as queue projection.
- Does not expose agent-callable tools directly; Doctor ToolNet owns that adapter layer.

## Exports

- ID aliases: `PriorAuthorizationCaseId`, `PriorAuthorizationRequestId`, `SubmissionPacketId`, `PayerUpdateId`, `PayerDeterminationId`, `WorkItemId`.
- Ports: `PriorAuthStore`, `ClinicalContextRepository`, `Clock`, `IdGenerator`.
- Domain root: `PriorAuthorizationCase`.
- Use Cases: `getPriorAuthorizationCase`, `listWorkItems`, `evaluateRequirements`, `getQuestionnairePackage`, `saveQuestionnaireResponse`, `listEvidence`, `buildSubmissionPacket`, `submitMockPacket`, `getCaseStatusTimeline`, `getCaseAuditTrace`.

## Verification

```bash
npm run build -w @open-prior-auth/prior-auth-core
npm test
```
