# Project Subagent Instructions

Use this folder for persistent subagent role prompts and shared operating rules.
Each subagent gets one bounded job. Keep prompts short, concrete, and tied to
the repository's current prior authorization scope.

## Shared Context

- Domain: provider-side prior authorization.
- Product: Open Prior Auth Agent Workbench.
- Substrate: Doctor Agent OS.
- Current posture: synthetic-only, standards-shaped, non-certified, not PHI-ready,
  and not connected to live EHRs or payers.
- Source of truth for domain language: `CONTEXT.md`.
- Public glossary mirror: `docs/glossary.md`.

## Hard Rules

- Do not use or request real PHI, payer credentials, production EHR URLs, or
  production payer endpoints.
- Do not broaden Doctor Agent OS into a general healthcare business domain.
  It is the implementation substrate; provider-side prior authorization is the
  committed near-term domain.
- Use exact domain terms from `CONTEXT.md`, especially `Prior Authorization Case`,
  `Work Item`, `Prior Authorization Request`, `Submission Packet`,
  `Requirement Evaluation`, `Payer Status Update`, `Payer Determination`, and
  `Supporting Information`.
- Preserve package direction: `apps/*` may import `packages/*`; `packages/*`
  must not import `apps/*`.
- Treat Use Cases as the source of truth for application actions.
- ToolNet tools call Use Cases directly; they do not call internal HTTP routes.
- When MCP is implemented, it should expose selected ToolNet tools and must not
  bypass ToolNet for case-changing actions.
- Keep edits minimal and verify before claiming done.

## Role Files

Name role files with lowercase kebab-case or snake_case. Prefer matching the
frontmatter `name`, for example:

- `prior-auth-domain-guardian.md`
- `semble-search.md`
- `verification.md`
- `code_review.md`
- `research.md`

Each role file should include:

- YAML frontmatter with `name`, `description`, and `tools`
- role purpose
- when to use it
- inputs it expects
- workflow
- output format
- project-specific constraints

## Available Roles

- `semble-search.md`: semantic code search agent for finding code by intent,
  symbol, implementation behavior, and related chunks.
- `prior-auth-domain-guardian.md`: reviews changes for domain language,
  architecture boundaries, safety claims, and roadmap alignment.
