# M5 Agent Cockpit Demo

M5 turns the workbench into a case-first cockpit. Business state leads the page: case header, next action, evidence-to-requirement board, questionnaire/package summary, packet preview, and audit/status timeline. Agent trace appears as a trust/debug layer after an explicit operator action.

## Run

```bash
npm run db:reset
npm run dev:api
npm run dev:web
```

Open the web app, choose either scenario, then:

1. Select `Seed selected scenario`.
2. Select a queue row if needed.
3. Select `Run deterministic agent team`.
4. Inspect `Current blocker / next action`.
5. Inspect `Agent run timeline`, `Evidence-to-requirement board`, `Questionnaire package summary`, `Packet preview`, and `Audit / status timeline`.

## Expected Behavior

- MRI and DME scenarios both seed and run from the same cockpit.
- The agent run is on demand; page load and queue selection do not auto-run agents.
- Questionnaire save receives scripted approval.
- Mock PAS submit pauses at ApprovalGate with pending human approval.
- No mock submission receipt is created by the cockpit agent run.
- Trace is visible, but the page remains organized around the prior-auth case.

## Verification

```bash
npm test
npm run typecheck
npm run build
```

The M5 route contract is covered by `tests/agent-cockpit.contract.test.mjs`.
