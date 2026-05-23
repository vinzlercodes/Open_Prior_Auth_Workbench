# Doctor ToolNet

Doctor ToolNet exposes Prior Auth Core Use Cases as agent-facing tool contracts.
M1b makes this a real workspace package.

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

## M1b Tools

Executable read/draft tools:

- `doctor.case.get`
- `doctor.queue.list_work_items`
- `doctor.case.get_status_timeline`
- `doctor.case.get_audit_trace`
- `doctor.evidence.list`
- `doctor.requirements.evaluate`
- `doctor.dtr.get_questionnaire_package`
- `doctor.pas.build_packet`

Declared guarded tools:

- `doctor.dtr.save_response`
- `doctor.pas.submit_mock`

Guarded tools return `APPROVAL_EXECUTOR_REQUIRED` until Doctor Runtime adds ApprovalGate.

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
- keeps guarded write/submit tools non-executable until ApprovalGate exists
