# Deterministic Screenshot Set

These screenshots are generated from checked-in synthetic demo fixtures. The numbered set proves the preserved M1-M4 workflow; the M5 cockpit screenshots prove the case-first agent cockpit for MRI and DME.

## Capture Setup

- API command: `npm run dev:api`
- Web command: `npm run dev:web`
- App URL: `http://localhost:3000`
- Browser viewport used for the checked-in M5 captures: `319px` wide from the Codex in-app browser visible capture surface. Most captures are `319x713`; the launch and requirements captures are `319x953` because they include taller context panels.
- Preferred viewport for future desktop recaptures when a full browser capture tool is available: `1440x1100`.
- Seed command for queue-focused states:

```bash
curl -s -X POST "http://127.0.0.1:4000/demo/seed-work-items" \
  -H 'Content-Type: application/json' \
  -d '{"count":3}'
```

## Expected Synthetic Context

- Patient: Elena Rivera
- Payer: Acme Health Plan
- Service: MRI lumbar spine without contrast
- Service line: `mri_lumbar_spine`
- Payer ID: `acme-health`
- Golden work item in a fresh API process: `wi-8a673eae6c28`

## Files

- `01-launch-shim.png`: proves the launch shim resolves the synthetic patient and order context.
- `02-requirements-result.png`: proves deterministic requirement discovery returns prior-auth requirements and the canonical evaluation ID.
- `03-dtr-workspace.png`: proves the local DTR-inspired form workspace opens with prefilled fields and validation state.
- `04-packet-ready.png`: proves a completed questionnaire can build a PAS-style local packet.
- `05-submitted-pended-queue.png`: proves a submitted case can appear as payer-pended in the operations queue while internal status remains submitted.
- `06-more-info-needed.png`: proves the mock payer more-info loop moves the case into the evidence workspace path.
- `07-terminal-approved-denied.png`: proves terminal approved/denied outcomes are visible in the queue and operations history.
- `m5-cockpit-mri.png`: proves the MRI cockpit shows case state first with explicit deterministic agent trace and pending submit approval.
- `m5-cockpit-dme.png`: proves the DME cockpit uses the same cockpit and agent path with DME-specific requirements and packet preview.

Regenerate these files whenever the visible demo flow materially changes.
