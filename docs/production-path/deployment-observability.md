# Deployment And Observability

## Current OSS Posture

The current repo runs local API and web services with local SQLite and checked-in fixtures. Builds, contract tests, and deterministic evals prove local behavior. There is no hosted environment model, no managed database, no object storage, no production secrets, no telemetry pipeline, no incident process, and no backup/restore posture.

## Production Requirement

Production needs separated environments, repeatable deploys, managed persistence, approved storage for evidence bytes, secure configuration, background work processing, backups, observability, uptime monitoring, incident response, retention policies, and operational ownership.

Observability must connect business events and technical signals: case lifecycle, Requirement Evaluation, questionnaire saves, evidence acceptance, packet builds, ApprovalGate decisions, `PayerUpdate`, `PayerDetermination`, ToolNet calls, external API calls, latency, errors, retries, and queue depth.

## Adapters / Interfaces To Build

- Config and secret provider that replaces local env defaults with environment-scoped runtime configuration.
- Managed storage provider for prior-auth state, audit state, eval reports, packet artifacts, and evidence bytes.
- Job/queue runtime for retries, status polling, background validation, and report generation.
- Observability exporters for logs, metrics, traces, audit correlation IDs, and case/run identifiers.
- Health, readiness, and dependency checks for API, web, database, object storage, identity provider, and external partner endpoints.
- Deployment and incident runbooks covering rollback, restore, partner outage, suspected PHI exposure, and stuck prior-auth flows.

## Non-Goals

- Do not implement OpenTelemetry, Langfuse, Kubernetes, cloud databases, object storage, or deployment manifests in M9.
- Do not claim readiness for production deployment from local build/test success.
- Do not store PHI or credentials in local demo paths such as `.data/`.

## Risks / Blockers

- Local SQLite behavior does not prove production durability, concurrency, migration, backup, or restore behavior.
- Logs, traces, and eval reports may contain sensitive data unless redaction and retention rules are designed up front.
- External EHR/payer outages need explicit degradation and queue behavior, not ad hoc retry loops.
- Background jobs can perform case-changing actions without proper ApprovalGate and audit boundaries if not designed with policy enforcement.

## Sequence Prerequisites

1. Define environment model: local, CI, sandbox, staging, production.
2. Choose managed database, object storage, secret manager, and telemetry targets.
3. Add backup/restore and migration rehearsal before persistent pilot data.
4. Add observability correlation IDs across ToolNet, runtime, HTTP, FHIR, and payer transport.
5. Run load, failure, restore, and incident-response drills before production traffic.
