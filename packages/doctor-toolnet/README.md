# Doctor ToolNet

Doctor ToolNet exposes Prior Auth Core Use Cases as agent-facing tool contracts.
It keeps runtime/cockpit tools ergonomic and adds standards-shaped sibling tools for CRD, DTR, and PAS boundary work.

## Public API

- `listDoctorTools()`
- `getDoctorToolDefinition(name)`
- `createDoctorToolRegistry(dependencies)`
- `executeDoctorTool(request, dependencies)`

Dependencies are concrete ports, not HTTP clients:

- `store: PriorAuthStore`
- `repository: ClinicalContextRepository`
- optional `uploadDirectory`
- optional `clock`
- optional `idGenerator`

## Runtime Tools

Executable read/draft tools:

- `doctor.case.get`
- `doctor.queue.list_work_items`
- `doctor.case.get_status_timeline`
- `doctor.case.get_audit_trace`
- `doctor.evidence.list`
- `doctor.requirements.evaluate`
- `doctor.dtr.get_questionnaire_package`
- `doctor.pas.build_packet`

Guarded runtime tools:

- `doctor.dtr.save_response`
- `doctor.pas.submit_mock`

## Standards-Shaped Sibling Tools

M6 added standards-shaped tools that preserve explicit local non-conformance metadata:

- `doctor.crd.discover_services`
- `doctor.crd.invoke_service`
- `doctor.dtr.get_questionnaire_package_fhir`
- `doctor.pas.build_claim_submit_bundle`
- `doctor.pas.submit_claim_fhir_mock`
- `doctor.pas.map_claim_response_to_runtime_receipt`

These tools are fixture-backed and local only. They do not claim certified CDS Hooks CRD, Da Vinci DTR, Da Vinci PAS, X12, live payer transport, PHI readiness, or real EHR integration.

Guarded submit tools return `APPROVAL_EXECUTOR_REQUIRED` when called directly through ToolNet. Doctor Runtime ApprovalGate can pause and resume them with human approval.

## Call Records

Every execution returns a `DoctorToolCallRecord` with:

- `callId`
- `toolName`
- `category`
- `riskLevel`
- `approvalRequired`
- `status`
- `startedAt`
- `completedAt`
- `input`
- optional `output`
- optional `error`

Boundary rules:

- calls Prior Auth Core Use Cases directly
- does not call internal HTTP routes
- does not fetch local servers
- does not import `apps/*`
- keeps guarded write/submit tools non-executable outside Doctor Runtime ApprovalGate
