# MCP Server

Status: Partial.

`packages/doctor-mcp` exposes read-only Doctor Agent OS resources, prompts, and ToolNet-derived tools. Guarded write and submit tools remain hidden from the initial MCP surface.

`apps/mcp-server` provides a local stdio JSON-RPC discovery surface for `tools/list`, `resources/list`, and `prompts/list`.
