# Agentic Story Flow

This story explains how the current M1-M7 workbench maps to the planned Doctor Agent OS flow. It is a product narrative, not an implementation claim.

## Current Runnable Baseline

The current demo remains the synthetic MRI lumbar spine / Acme Health flow:

1. Load local patient, coverage, order, encounter, practitioner, organization, condition, and observation context.
2. Run deterministic Requirement Evaluation against a local Rule Pack.
3. Create a Work Item as operations projection of the Prior Authorization Case.
4. Open the local DTR-inspired Documentation Workspace.
5. Complete the Questionnaire Session.
6. Attach or upload synthetic Supporting Information.
7. Accept Supporting Information for packet inclusion.
8. Build a PAS-style Submission Packet.
9. Submit through mock PAS transport.
10. Track queue state, payer status updates, additional-information flow, terminal outcomes, audit events, and metrics in SQLite.

## Planned Agentic Flow

Doctor Agent OS will keep the same business case primary while adding agent execution around it:

1. Prior Auth Core reads the case and executes Use Cases.
2. ToolNet exposes safe read/draft tools over those Use Cases.
3. Doctor Runtime records ordered agent runs, tasks, tool calls, approvals, and trace events.
4. Deterministic prior-auth agents inspect the case, evaluate requirements, inspect forms/evidence, preview packets, and stop at ApprovalGate for guarded writes/submits.
5. MCP exposes selected ToolNet tools to external agent clients without bypassing approval or trace boundaries.
6. Doctor Evals check golden traces, tool policy, approval requirements, and safety claim language.

## Design Principle

The case remains the product center. Agent trace is a trust/debug layer that explains what happened and why. It does not replace the provider-side prior authorization workflow.
