# M8 Formal Doctor Evals

M8 added deterministic regression and safety evals for the synthetic Doctor Agent OS prior-auth flow.

Run:

```bash
npm run evals
```

Expected output:

```text
M8 Doctor Evals: passed
Scenarios: 4/4 passed
Assertions: 88/88 passed
```

Reports:

- `packages/doctor-evals/reports/latest.json`
- `packages/doctor-evals/reports/latest.md`

Covered scenarios:

- `mri_happy_path`
- `dme_power_wheelchair_happy_path`
- `mri_missing_evidence`
- `mri_prompt_injection_evidence`

The eval harness verifies golden normalized traces, allowed tools, guarded ApprovalGate behavior, no internal HTTP tool calls, no false safety/conformance/submission claims, and malicious evidence text treated as packet data only.
