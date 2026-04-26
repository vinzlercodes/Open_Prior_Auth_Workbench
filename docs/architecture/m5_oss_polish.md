# M5 OSS Polish

## Boundary

M5 makes the M1-M4 synthetic prior authorization workbench easier for external builders to clone, understand, verify, and extend. It is a documentation, CI, fixture-indexing, and demo-artifact milestone.

M5 does not change the canonical case lifecycle, API behavior, shared contracts, payer logic, questionnaire behavior, packet builder, or operations metrics.

## Deliverables

- README refresh with quickstart, milestone map, API surface, license reference, and explicit non-conformance boundaries.
- Contributor, code-of-conduct, humble security reporting, and local environment example docs.
- GitHub Actions CI on Node 22 and Node 24.
- Fixture index for synthetic seed data, payer rules, questionnaires, and deterministic IDs.
- Deterministic screenshot set for the local synthetic demo.
- Docs-only automation recipes that call existing local APIs.

## Non-goals

- No production SMART App Launch.
- No CDS Hooks CRD conformance claim.
- No real FHIR `$questionnaire-package` operation.
- No Da Vinci PAS `$submit`, payer inquiry, endpoint discovery, or X12 278 transport.
- No real payer adjudication.
- No durable database, Temporal workflow engine, Medplum-backed persistence, or production deployment hardening.
- No real PHI, payer credentials, production EHR URLs, or production payer endpoints.

## CI Support Policy

CI targets Node 22 as the minimum supported LTS runtime and Node 24 as the current LTS runtime. Node 23 is excluded from documentation and CI because it is end-of-life.

The CI contract is intentionally small:

- `npm ci`
- `npm test`
- `npm run typecheck`
- `npm run build`

No formatter or linter is added in M5 because none is already configured and this milestone should not create style churn.

## Screenshot Policy

Screenshots are generated from the checked-in synthetic MRI lumbar spine fixtures. They should be captured at the documented viewport in `demo/screenshots/README.md` and updated only when the visible demo flow materially changes.

The screenshot set proves launch context, requirement discovery, DTR workspace, packet readiness, submitted/pended queue behavior, more-info-needed workflow, and terminal outcomes.

## Community Governance Posture

M5 adds lightweight community docs for external builders. `SECURITY.md` intentionally describes a modest reporting path and does not imply a mature security response program. Broader governance, maintainer rotation, release management, and support policies are deferred.

## OSS Readiness Checklist

- Fresh clone can run quickstart successfully.
- README explains M1-M4 in plain language.
- README clearly says this is not production SMART, CRD, DTR, PAS, payer adjudication, or payer transport.
- README references Apache-2.0 licensing.
- CI passes on Node 22 and Node 24.
- Node 23 is not documented as supported because it is end-of-life.
- All demo screenshots are generated from synthetic fixtures.
- All fixture files are indexed and safe to modify.
- All automation recipes are docs-only and call existing APIs.
- No docs instruct use of PHI, real payer credentials, real EHR data, or production endpoints.
