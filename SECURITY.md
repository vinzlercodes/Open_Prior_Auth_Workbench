# Security

Open Prior Auth Agent Workbench is a synthetic-data-only reference project. It has local API, web, ToolNet, Runtime, Agent Cockpit, standards-shaped gateway, and Doctor Evals surfaces, but it does not have a formal security response program, paid bounty, or guaranteed response timeline.

## Reporting A Concern

If you believe you found a vulnerability, please contact the maintainers through a private GitHub security advisory when available, or by opening a GitHub issue that asks for a private reporting path without including sensitive details.

Please include:

- A short description of the issue.
- Steps to reproduce using synthetic local data.
- The affected branch, commit, or release if known.
- Any relevant logs with secrets and local identifiers removed.

## Do Not Send Sensitive Data

Do not include PHI, real patient data, payer credentials, production EHR URLs, production payer endpoints, access tokens, private keys, or customer-specific configuration in reports, issues, pull requests, screenshots, or logs.

## Scope

Security reports are most useful when they involve the checked-in local API, web app, ToolNet tools, Runtime approval/trace behavior, eval harness, fixtures, CI configuration, or documentation. Reports about production deployment hardening may still be helpful, but this repository does not currently claim production readiness, PHI readiness, certified conformance, or live EHR/payer connectivity.
