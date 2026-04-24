# Compose Notes

M1 intentionally keeps infrastructure light. The API uses a fixture-backed FHIR adapter that preserves the Medplum boundary without requiring self-hosted healthcare infrastructure during the first sprint.

When Medplum self-hosting becomes useful, add its services here and keep the API-facing contract stable:

- Patient, coverage, encounter, practitioner, organization, and request lookup stays behind the FHIR repository interface.
- Requirement evaluation remains deterministic.
- `POST /work-items` continues to reference stored evaluation results by `evaluationId`.
