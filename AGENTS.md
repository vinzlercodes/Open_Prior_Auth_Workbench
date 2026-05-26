# Repository Guidelines

## Project Structure & Module Organization
This repository is now a TypeScript monorepo plus documentation set for Open Prior Auth Agent Workbench. The main product code lives in `apps/` and `packages/`; the strategy report PDF at the repo root remains a reference artifact, not the only deliverable. The `doctor/` directory is a local Python virtual environment, not application source code. `.idea/` contains editor metadata and should be treated as local-only workspace state.

Keep production modules out of `doctor/`. Application code belongs under `apps/*`; reusable package code belongs under `packages/*`; contract tests belong in `tests/`.

## Build, Test, and Development Commands
Use Node `>=22.18.0`. Current useful local commands are:

```bash
npm ci
npm run db:migrate
npm test
npm run typecheck
npm run build
npm run evals
```

Local demo commands:

```bash
npm run dev:api
npm run dev:web
```

Use `python3.14 -m venv doctor` only to recreate the disposable local Python environment for document tooling. Avoid editing files under `doctor/lib/` directly; reinstall packages instead.

## Coding Style & Naming Conventions
Use Markdown for repository documentation and keep sections short, task-oriented, and scannable. Follow the existing filename pattern of descriptive lowercase snake_case for generated artifacts, for example `prior_auth_summary.docx`.

For TypeScript, follow the existing workspace style: ESM modules, explicit exported types at package boundaries, and conservative dependency direction (`apps/*` may import `packages/*`; `packages/*` must not import `apps/*`). No formatter or linter is configured yet, so keep style conservative and consistent.

## Testing Guidelines
Add or update Node contract tests under `tests/` when behavior changes. Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run evals` before marking meaningful changes complete. For document-only changes, still run the relevant verification unless the change cannot affect code paths.

## Commit & Pull Request Guidelines
Use short imperative commit messages such as `docs: update current status` or `test: add report validation checks`.

Pull requests should include a brief summary, the files changed, and screenshots or exported previews when document layout changes materially.

## Workflow Orchestration

### Plan Mode Default
- Enter plan mode for any non-trivial task, defined as 3+ steps, architectural decisions, or meaningful uncertainty.
- Write detailed specs upfront to reduce ambiguity.
- Use plan mode for verification steps, not just implementation.
- If something goes sideways, stop and re-plan immediately.

### Subagent Strategy
- Use subagents liberally to keep the main context window clean.
- Offload research, exploration, and parallel analysis to focused subagents.
- Use one task per subagent.
- For complex problems, use additional subagents rather than overloading one thread.

### Self-Improvement Loop
- After any correction from the user, update `tasks/lessons.md` with the pattern.
- Write rules that prevent the same mistake from recurring.
- Review relevant lessons at session start.
- Ruthlessly iterate on these lessons until the mistake rate drops.

### Verification Before Done
- Never mark a task complete without proving it works.
- Run tests, check logs, and demonstrate correctness where applicable.
- Diff behavior between main and the current changes when relevant.
- Ask: “Would a staff engineer approve this?”

### Demand Elegance, Balanced
- For non-trivial changes, pause and ask whether there is a more elegant approach.
- If a fix feels hacky, rework it into the simplest elegant solution.
- Skip this for simple, obvious fixes; do not over-engineer.
- Challenge the work before presenting it.

### Autonomous Bug Fixing
- When given a bug report, investigate and fix it without asking for unnecessary hand-holding.
- Use logs, errors, failing tests, and reproduction steps to identify the root cause.
- Fix failing CI tests without waiting for step-by-step instructions.
- Minimize context switching for the user.

## Task Management
- Plan first: write the plan to `tasks/todo.md` with checkable items.
- Verify the plan: check in before starting implementation when the task is substantial or ambiguous.
- Track progress: mark items complete as work proceeds.
- Explain changes: provide high-level summaries at meaningful milestones.
- Document results: add a review section to `tasks/todo.md`.
- Capture lessons: update `tasks/lessons.md` after user corrections.
- Demo artifacts: for meaningful changes, create or update a `demo/` folder containing clear reproduction steps, test instructions, expected outputs, screenshots or sample data when useful, and any commands needed to verify the project behavior.

## Core Principles
- Simplicity first: make every change as simple as possible.
- Minimal impact: touch only what is necessary.
- No laziness: find root causes, avoid temporary fixes, and hold senior developer standards.
- No side effects: avoid unrelated changes that introduce new bugs.

## Security & Configuration Tips
Do not commit secrets, patient data, or environment-specific credentials. Keep the local virtual environment disposable, and do not treat `doctor/` as a source directory.

## Code Search

Use `semble search` to find code by describing what it does or naming a symbol/identifier, instead of grep:

```bash
semble search "authentication flow" ./my-project
semble search "save_pretrained" ./my-project
semble search "save model to disk" ./my-project --top-k 10
```

If you anticipate doing more than one search, use `semble index` to create an index.

```bash
semble index ./my-project -o my_index
```

You can then reuse this index later on:

```bash
semble search "save_pretrained" --index my_index
```

An index is not automatically updated, so if the code changes significantly, reindex. If you notice stale results while resolving searches to files, reindex.

Use `--content docs` to search documentation and prose, `--content config` for config files (yaml, toml, etc.), or `--content all` to search code, docs, and config:

```bash
semble search "deployment guide" ./my-project --content docs
semble search "database host port" ./my-project --content config
semble search "authentication" ./my-project --content all
```

Use `semble find-related` to discover code similar to a known location (pass `file_path` and `line` from a prior search result):

```bash
semble find-related src/auth.py 42 ./my-project
```

Like search, `find-related` also accepts an `--index` argument.

`path` defaults to the current directory when omitted; git URLs are accepted.

If `semble` is not on `$PATH`, use `uvx --from "semble[mcp]" semble` in its place.

### Workflow

1. Index the repo using `semble index -o cached_index`.
2. Start with `semble search` to find relevant chunks. Pass the index to achieve results faster.
3. Use `--content docs` for documentation, `--content config` for config files, or `--content all` for everything.
4. Inspect full files only when the returned chunk does not give enough context.
5. Optionally use `semble find-related` with a promising result's `file_path` and `line` to discover related implementations.
6. Use grep only when you need exhaustive literal matches or quick confirmation of an exact string.
