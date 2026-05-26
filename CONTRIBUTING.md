# Contributing

Thanks for helping improve Open Prior Auth Agent Workbench. This repo is a synthetic-data-only Doctor Agent OS reference system for provider-side prior authorization, so contributions should keep the product easy to run locally and safe for external builders to inspect.

## Local Setup

Use Node 22 or Node 24. Node 23 is not documented as supported because it is end-of-life.

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Run the local demo with two terminals:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

The API defaults to `http://localhost:4000`. The web app defaults to `http://localhost:3000`.

## Contribution Expectations

- Keep runtime changes small and milestone-scoped.
- Preserve synthetic-only fixtures; never add PHI or real patient data.
- Do not add production payer credentials, EHR URLs, secrets, or customer-specific endpoints.
- Update `README.md`, `demo/README.md`, `data/README.md`, or architecture notes when behavior or fixtures change.
- Add or update contract tests when API behavior changes.
- Update Doctor Evals scenarios, golden traces, or policy assertions when agent/tool behavior changes.
- Keep generated build outputs out of the repo.

## Pull Request Checklist

- `npm test` passes.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm run evals` passes when runtime, ToolNet, agent, evidence, packet, or safety-claim behavior changes.
- Docs describe any new route, tool, fixture, eval scenario, or demo step.
- Screenshots are updated when the visible demo workflow materially changes.
- The PR summary calls out affected surfaces: Prior Auth Core, ToolNet, Runtime, Agent Cockpit, standards gateway, Doctor Evals, docs, or production-path docs.

## Data Safety

All committed examples must be synthetic. If a contribution needs a new patient, payer, rule, or document example, create a minimal synthetic fixture and document it in `data/README.md`.
