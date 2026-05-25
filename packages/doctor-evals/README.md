# Doctor Evals

Deterministic M8 regression and safety harness for Doctor Agent OS.

This package is not an eval platform. It runs narrow synthetic checks over the local prior-authorization runtime, ToolNet tools, ApprovalGate behavior, golden traces, and safety boundary claims.

## Scenarios

- `mri_happy_path`: deterministic MRI prior-auth agent team.
- `dme_power_wheelchair_happy_path`: same agent workflow over DME fixtures.
- `mri_missing_evidence`: requirement-only missing-baseline-data path.
- `mri_prompt_injection_evidence`: malicious synthetic evidence stays packet data, not agent instruction.

## Checks

- Golden normalized trace diffs.
- Allowed ToolNet tool policy.
- Guarded write/submit ApprovalGate assertions.
- No internal HTTP route/tool calls from ToolNet, runtime, or eval source.
- No false PHI readiness, certified conformance, or real payer submission claims.
- JSON and Markdown reports.

## Commands

```bash
npm run evals
```

Reports are written to:

- `packages/doctor-evals/reports/latest.json`
- `packages/doctor-evals/reports/latest.md`

The harness uses only synthetic checked-in fixtures and package-level ports. It does not import `apps/api`, call localhost, use an LLM judge, benchmark models, provide a dashboard, or add production observability.
