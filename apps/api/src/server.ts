import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import type { RequirementEvaluationRequest, WorkItemCreateRequest } from "@open-prior-auth/shared-types";
import { evaluateRequirement } from "./evaluation/evaluate.js";
import { FixtureFhirRepository } from "./fhir/fixtureRepository.js";
import { MemoryStore } from "./storage/memoryStore.js";

export interface ApiDependencies {
  repository?: FixtureFhirRepository;
  store?: MemoryStore;
}

export function createServer(dependencies: ApiDependencies = {}) {
  const repository = dependencies.repository ?? new FixtureFhirRepository();
  const store = dependencies.store ?? new MemoryStore();

  return createHttpServer(async (request, response) => {
    try {
      await routeRequest(request, response, repository, store);
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unexpected API error"
      });
    }
  });
}

async function routeRequest(
  request: IncomingMessage,
  response: ServerResponse,
  repository: FixtureFhirRepository,
  store: MemoryStore
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      service: "open-prior-auth-api",
      status: "ok",
      mode: "m1-fixture-backed-medplum-boundary"
    });
    return;
  }

  const contextMatch = url.pathname.match(/^\/context\/patient\/([^/]+)$/);
  if (request.method === "GET" && contextMatch) {
    sendJson(response, 200, repository.getPatientContext(decodeURIComponent(contextMatch[1])));
    return;
  }

  if (request.method === "POST" && url.pathname === "/requirements/evaluate") {
    const body = await readJson<RequirementEvaluationRequest>(request);
    const result = evaluateRequirement(body, repository);
    sendJson(response, 200, store.saveEvaluation(body, result));
    return;
  }

  if (request.method === "POST" && url.pathname === "/work-items") {
    const body = await readJson<WorkItemCreateRequest>(request);
    sendJson(response, 201, store.createWorkItem(body));
    return;
  }

  const workItemMatch = url.pathname.match(/^\/work-items\/([^/]+)$/);
  if (request.method === "GET" && workItemMatch) {
    const workItem = store.getWorkItem(decodeURIComponent(workItemMatch[1]));
    if (!workItem) {
      sendJson(response, 404, { error: "Work item not found" });
      return;
    }
    sendJson(response, 200, workItem);
    return;
  }

  sendJson(response, 404, { error: "Route not found" });
}

async function readJson<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawBody = Buffer.concat(chunks).toString("utf8");
  return rawBody ? JSON.parse(rawBody) as T : {} as T;
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  });
  if (statusCode === 204) {
    response.end();
    return;
  }
  response.end(JSON.stringify(payload, null, 2));
}
