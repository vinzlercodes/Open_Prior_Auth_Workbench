# MCP Boundary

The MCP Boundary is the planned external agent interoperability layer for Doctor Agent OS. ToolNet and Runtime now exist; MCP remains the next unimplemented protocol boundary and is still represented only by docs and the `packages/doctor-mcp/README.md` placeholder.

## Purpose

Planned MCP support will expose selected resources, prompts, and ToolNet tools to external agent clients without letting those clients bypass ToolNet risk metadata, approval metadata, or traceability.

## Rules

- MCP should expose selected ToolNet tools.
- MCP does not call Prior Auth Core directly for case-changing actions.
- MCP does not call internal HTTP routes as a shortcut.
- Guarded ToolNet tools remain governed by ApprovalGate.
- Public MCP docs must preserve synthetic-only, non-certified, non-PHI-ready language.

## Non-Goals

- No MCP implementation yet.
- No direct live payer/EHR connector.
- No PHI-ready claim.
- No certified standards conformance claim.
