# M8 Standards Conformance Fixture Harness

## Boundary

M8 adds fixture-backed standards-shaped routes for SMART discovery, CDS Hooks CRD primary hooks, Da Vinci DTR questionnaire packaging, and Da Vinci PAS Claim submit. It remains a local synthetic developer harness. It does not implement production SMART OAuth, payer endpoint discovery, real payer transport, X12 translation, Inferno certification, or real EHR integration.

All M8 standards surfaces return `productionConformance: false` where metadata allows it, and `/standards/boundaries` uses M8 contract versions to make the replacement points explicit.

## SMART Discovery

SMART discovery is available at the FHIR-base-shaped route:

```text
GET /fhir/.well-known/smart-configuration
```

The existing root alias remains available:

```text
GET /.well-known/smart-configuration
```

Both return local authorization and token endpoint metadata for fixture use only.

## CRD Fixture Hooks

M8 exposes CDS Hooks discovery and three primary CRD fixture services:

```text
GET /cds-services
POST /cds-services/open-prior-auth-appointment-book
POST /cds-services/open-prior-auth-order-dispatch
POST /cds-services/open-prior-auth-order-sign
```

The services map only the synthetic MRI lumbar spine patient, coverage, payer, and ServiceRequest. Successful responses use CDS Hooks `systemActions` with a coverage-information extension. Coverage information is not returned as a card.

## DTR Questionnaire Package

The standards-shaped DTR route is:

```text
POST /fhir/Questionnaire/$questionnaire-package
```

It accepts a FHIR `Parameters` fixture input and returns a FHIR `Parameters` resource with `packagebundle` parameters. Each `packagebundle.resource` is a collection Bundle containing one Questionnaire, one draft QuestionnaireResponse, and dependency Library/ValueSet resources.

The local alias remains:

```text
POST /dtr/questionnaire-package
```

That alias keeps its local wrapper response for existing workbench behavior.

## PAS Claim Submit

The standards-shaped PAS route is:

```text
POST /fhir/Claim/$submit
```

It accepts a Bundle containing a PAS-like Claim request and returns a direct Bundle containing a ClaimResponse. It does not wrap the successful response in Parameters.

## Fixtures And Verification

Standards request fixtures live under `data/standards/`.

Required verification:

```bash
npm test
npm run typecheck
npm run build
```
