# Prior Auth Agent Team

Deterministic prior-authorization agent workflow package for Doctor Agent OS.

This package owns the prior-auth-specific orchestration over generic Doctor Runtime primitives and Doctor ToolNet tools. Doctor Runtime stays workflow-agnostic; this package supplies the ToolNet bridge and scripted prior-auth agent team.

## Exports

- `createPriorAuthRuntimeToolCatalog`
- `runDeterministicPriorAuthAgentTeam`
- deterministic role classes used by tests and demos

## Boundaries

- May import Doctor Runtime, Doctor ToolNet, Prior Auth Core, and shared types.
- Must not import `apps/*`.
- Keeps synthetic-only, non-PHI-ready, non-certified behavior.
