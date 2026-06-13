# Agentic Gap Closure Demo Verification

This folder tracks the implementation path for the agentic gap audit. All flows are synthetic-only, local-first, non-PHI, and non-certified.

## Verify

```bash
npm test
npm run typecheck
npm run build
npm run evals
npm run evals:report
npm run package-boundaries
```

Expected:

- Contract tests pass.
- TypeScript builds all workspaces.
- Doctor Evals report all scenarios passing and write `packages/doctor-evals/reports/latest.json` plus `latest.md`.
- Package-boundary test confirms `packages/*` do not import `apps/*`.
