# Glossary

`CONTEXT.md` is the working modeling source of truth. This file is the public stabilized mirror for terms that appear in docs, package boundaries, and future implementation plans.

## Domain Terms

**Prior Authorization Case**: The provider-side lifecycle for one service authorization need, from order context through final approval, denial, or cancellation. This is the domain root.

**Work Item**: A queue or task representation of a Prior Authorization Case for staff operations. It is a projection, not the domain root.

**Prior Authorization Request**: The payer-facing request for authorization, usually represented by a standards-shaped submission artifact.

**Prior Authorization Request Status**: The payer-facing request thread phase. It does not contain final payer outcomes such as approved, denied, cancelled, or pended.

**Submission Packet**: The assembled clinical, questionnaire, and supporting information payload prepared for payer submission.

**Payer Authorization Thread**: The payer-facing continuity record for tracking communications about one Prior Authorization Request.

**Additional Information Request**: A payer request for more supporting information on an existing Prior Authorization Request.

**Requested Information Item**: A specific document, attachment code, questionnaire, or evidence item requested within an Additional Information Request.

**Baseline Information Gap**: Provider-side information the workbench believes is needed before a clean initial submission can be made.

**Prior Authorization Policy**: A payer's authorization criteria and documentation expectations for a planned service.

**Rule Pack**: A local implementation artifact that encodes a Prior Authorization Policy for deterministic evaluation.

**Requirement Evaluation**: A provider-side evaluation of a Prior Authorization Policy for a planned service. It is not a payer determination.

**Payer Status Update**: A non-final payer update about the handling state of a Prior Authorization Request.

**Payer Determination**: The payer's formal adjudication result for a Prior Authorization Request, such as approved, denied, or cancelled.

**Prior Authorization Case Lifecycle Status**: The provider-side workflow stage of a Prior Authorization Case.

**Closure Reason**: The reason a Prior Authorization Case reached a closed or abandoned state.

**Documentation Workspace**: The staff-facing activity area for completing forms, resolving gaps, and gathering Supporting Information.

**Questionnaire Session**: Saved state for a specific form-filling interaction within a Documentation Workspace.

**Supporting Information**: Clinical or administrative information supplied to justify, complete, or update a Prior Authorization Request.

**Supporting Documentation**: Document-like Supporting Information, such as notes, reports, letters, or PDFs.

**Attachment**: A transport or packet representation of Supporting Information sent to a payer.

**Order Group**: Related ordered services from the same clinical ordering context, such as an encounter or requisition.

## Agentic Platform Terms

**Doctor Agent OS**: The reusable agentic implementation platform for Open Prior Auth Agent Workbench. It is an implementation substrate, not the product domain.

**Open Prior Auth Agent Workbench**: The provider-side prior authorization application built on Doctor Agent OS.

**Agentic Platform**: The implementation substrate for agent runtime, tool registry, MCP boundary, workflow state, approvals, traces, evaluations, and policy checks.

**Use Case**: A business action that coordinates domain services for one prior authorization or platform capability. HTTP routes and ToolNet tools adapt Use Cases.

**ToolNet Tool**: An agent-facing action contract that exposes a Use Case with schemas, risk metadata, approval metadata, and traceability.

**Prior Auth Core**: The package boundary that owns provider-side prior authorization Use Cases and ports.

**MCP Boundary**: The external agent interoperability boundary that exposes selected resources, prompts, and ToolNet tools.

**Healthcare Administrative Workflow**: Future expansion category for administrative workflows beyond prior authorization. It is outside near-term scope unless it supports the prior authorization wedge.

## Relationship Rules

- A Prior Authorization Case may appear as one or more Work Items.
- A Prior Authorization Case may produce one or more Prior Authorization Requests.
- A Prior Authorization Request belongs to exactly one Prior Authorization Case.
- A Prior Authorization Request may be supported by one or more Submission Packets.
- Routine more-info responses usually create a new Submission Packet under the same Prior Authorization Request.
- A new Prior Authorization Request is created only when service, coverage, payer thread, or payer instruction makes it a materially new authorization intent.
- A Prior Authorization Request may receive Payer Status Updates before a Payer Determination.
- A Work Item derives staff-facing effective status from Prior Authorization Case Lifecycle Status, latest Payer Status Update, and Payer Determination.
- A Documentation Workspace belongs to one Prior Authorization Case.
- A Requested Information Item is fulfilled by Supporting Information.
- Supporting Information may be represented as an Attachment when exchanged with a payer.
- Doctor Agent OS is the implementation platform for Open Prior Auth Agent Workbench.
- Prior Auth Core is the source of truth for provider-side prior authorization Use Cases.
- HTTP routes and ToolNet tools are sibling adapters over Use Cases.
- ToolNet tools do not call internal HTTP routes.
- MCP exposes selected ToolNet tools and does not bypass ToolNet for case-changing actions.
- `apps/*` may import `packages/*`; `packages/*` must not import `apps/*`.
