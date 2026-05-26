# Doctor MCP

README-only placeholder for the next unimplemented Doctor Agent OS protocol boundary.

This planned package will expose selected Doctor ToolNet tools, resources, and prompts through MCP. ToolNet, Runtime, ApprovalGate, Agent Cockpit, standards-shaped gateway routes, and Doctor Evals now exist; MCP remains unimplemented until a dedicated milestone adds a real package manifest, source, tests, and docs.

Boundary rules:

- MCP should expose selected ToolNet tools
- MCP does not bypass ToolNet for case-changing actions
- MCP does not call internal HTTP routes as a shortcut
- guarded tools remain governed by ApprovalGate
- MCP docs must preserve synthetic-only, non-certified, non-PHI-ready language
