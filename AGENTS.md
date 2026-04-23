# Repository Guidelines

## Project Structure & Module Organization
This repository is currently document-first. The primary deliverable is [`open_prior_auth_workbench_strategy_report.docx`](./open_prior_auth_workbench_strategy_report.docx) at the repo root. The `doctor/` directory is a local Python 3.14 virtual environment, not application source code. `.idea/` contains editor metadata and should be treated as local-only workspace state.

If code is added later, keep production modules out of `doctor/`; create a dedicated source folder such as `src/` or `app/`, and place tests in `tests/`.

## Build, Test, and Development Commands
No build pipeline or automated test suite is checked in yet. Current useful local commands are:

```bash
python3.14 -m venv doctor
source doctor/bin/activate
python -m pip list
```

Use the first command only to recreate the local virtual environment. Activate it before running any Python-based document tooling you add. Avoid editing files under `doctor/lib/` directly; reinstall packages instead.

## Coding Style & Naming Conventions
Use Markdown for repository documentation and keep sections short, task-oriented, and scannable. Follow the existing filename pattern of descriptive lowercase snake_case for generated artifacts, for example `prior_auth_summary.docx`.

For future Python code, use 4-space indentation, `snake_case` for functions and modules, and `PascalCase` for classes. No formatter or linter is configured yet, so keep style conservative and consistent.

## Testing Guidelines
There are no committed tests today. If you introduce Python code, add `pytest` tests under `tests/` and name files `test_<module>.py`. For document changes, verify the `.docx` opens cleanly and that headings, tables, and pagination render as expected before submitting.

## Commit & Pull Request Guidelines
This workspace does not currently include Git history, so there is no repository-specific commit convention to copy. If the project is initialized as a Git repo, use short imperative commit messages such as `docs: update prior auth report` or `test: add report validation checks`.

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

## Core Principles
- Simplicity first: make every change as simple as possible.
- Minimal impact: touch only what is necessary.
- No laziness: find root causes, avoid temporary fixes, and hold senior developer standards.
- No side effects: avoid unrelated changes that introduce new bugs.

## Security & Configuration Tips
Do not commit secrets, patient data, or environment-specific credentials. Keep the local virtual environment disposable, and do not treat `doctor/` as a source directory.
