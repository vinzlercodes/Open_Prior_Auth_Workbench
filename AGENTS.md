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

## Security & Configuration Tips
Do not commit secrets, patient data, or environment-specific credentials. Keep the local virtual environment disposable, and do not treat `doctor/` as a source directory.
