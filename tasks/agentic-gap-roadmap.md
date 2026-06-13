# Agentic Gap Closure Roadmap

Source: `docs/current-shortcomings-and-agentic-gap-audit.md`

## Phases

- [x] Phase 0: Tracking and baseline verification.
- [x] Phase 1: Package and script foundation.
- [x] Phase 2 foundation: ToolNet metadata and policy package surface.
- [x] Phase 3 foundation: MCP read-only catalog and stdio app surface.
- [x] Phase 4 foundation: generic runner/planner/resumer interfaces.
- [x] Phase 5 foundation: workflow checkpoint, signal, idempotency, and worker surface.
- [x] Phase 6: API server split into HTTP compatibility module and router/response landing zones.
- [x] Phase 7: first-class evidence mapping persistence.
- [x] Phase 8: deep approval lifecycle UI and execution states.
- [x] Phase 9: expanded scenarios and scorecard HTML.
- [x] Phase 10: cockpit panel component split, docs, scale note, and changelog foundation.

## Baseline

- `npm test`: passed 92/92 with localhost permission after sandbox-only `listen EPERM`.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run evals`: passed 4/4 scenarios, 88/88 assertions.

## Final Verification

- `npm test`: passed 108/108.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- `npm run evals`: passed 12/12 scenarios, 256/256 assertions.
- `npm run evals:report`: passed 12/12 scenarios, 256/256 assertions.
- `npm run package-boundaries`: passed.
- `gitnexus_detect_changes`: unavailable; MCP returned `Transport closed`.
