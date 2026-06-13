# Policy Engine

Status: Partial.

`packages/doctor-policy` provides local policy checks for ToolNet execution, standards overclaim prevention, prompt-injection-as-data handling, and local role/case permission stubs.

Runtime now records `policy.checked` trace events before tool execution or approval pause. Current checks are deterministic and synthetic-only.
