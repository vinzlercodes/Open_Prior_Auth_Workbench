import {
  listDoctorMcpPrompts,
  listDoctorMcpResources,
  listDoctorMcpTools
} from "@open-prior-auth/doctor-mcp";

export function describeMcpServer() {
  return {
    name: "open-prior-auth-doctor-mcp",
    transport: process.env.DOCTOR_MCP_TRANSPORT ?? "stdio",
    resources: listDoctorMcpResources(),
    prompts: listDoctorMcpPrompts(),
    tools: listDoctorMcpTools()
  };
}

export interface McpJsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export function handleMcpRequest(request: McpJsonRpcRequest) {
  if (request.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { tools: listDoctorMcpTools() }
    };
  }
  if (request.method === "resources/list") {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { resources: listDoctorMcpResources() }
    };
  }
  if (request.method === "prompts/list") {
    return {
      jsonrpc: "2.0",
      id: request.id ?? null,
      result: { prompts: listDoctorMcpPrompts() }
    };
  }
  return {
    jsonrpc: "2.0",
    id: request.id ?? null,
    error: {
      code: -32601,
      message: `Unsupported local MCP method: ${request.method}`
    }
  };
}

export async function runStdioServer(input = process.stdin, output = process.stdout): Promise<void> {
  let buffer = "";
  input.setEncoding("utf8");
  for await (const chunk of input) {
    buffer += chunk;
  }
  for (const line of buffer.split(/\r?\n/).filter((candidate) => candidate.trim().length > 0)) {
    output.write(`${JSON.stringify(handleMcpRequest(JSON.parse(line) as McpJsonRpcRequest))}\n`);
  }
}

if (process.argv[1]?.endsWith("index.js")) {
  if (process.stdin.isTTY) {
    process.stdout.write(`${JSON.stringify(describeMcpServer(), null, 2)}\n`);
  } else {
    await runStdioServer();
  }
}
