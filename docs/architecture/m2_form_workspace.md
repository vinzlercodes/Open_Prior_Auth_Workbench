# M2 Form Workspace

> Pre-agentic baseline note: this document describes the preserved M2 local prior-auth workbench baseline before the Doctor Agent OS roadmap reset. See [../roadmap.md](../roadmap.md) for current M0-M9 direction.

## Boundary

M2 added a local DTR-inspired form workspace on top of the M1 requirements sandbox. The implementation keeps the DTR vocabulary visible, but it does not claim conformance to the real FHIR `$questionnaire-package` operation.

The local package response includes:

- Questionnaire
- draft QuestionnaireResponse
- questionnaire canonical and version
- empty Library and ValueSet dependency arrays
- deterministic prefill provenance
- validation result
- completion percentage
- local session metadata for revision and prefill overrides

## Lifecycle Rules

- Work item status and QuestionnaireResponse status are separate.
- Save draft leaves the work item in `questionnaire_in_progress` and the QuestionnaireResponse in `in-progress`.
- Mark ready for review succeeds only when validation has no error issues.
- Successful mark ready moves the work item to `review_ready` and the QuestionnaireResponse to `completed`.
- Prefill overrides live in `QuestionnaireSession.prefillOverrides`, not inside the FHIR QuestionnaireResponse.

## Validation Rules

M2 validation checks required enabled items, answer value type, fixed-choice `answerOption` membership, and disabled `enableWhen` answers. Disabled required items are ignored for completion and required validation.

## Future Compatibility

The package shape reserves dependency slots for Library and ValueSet resources so Refero, Smart Forms, CQL, or real DTR package bundles can be introduced later without reshaping the product API.
