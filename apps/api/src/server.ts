import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import type {
  MoreInfoRequestCreateRequest,
  PacketBuildRequest,
  PacketSubmitRequest,
  PayerStatusRecordRequest,
  QuestionnairePackageRequest,
  QuestionnaireResponseSaveRequest,
  RequirementEvaluationRequest,
  WorkItemCreateRequest
} from "@open-prior-auth/shared-types";
import { OperationOutcomeError } from "./errors.js";
import { evaluateRequirement } from "./evaluation/evaluate.js";
import { FixtureFhirRepository } from "./fhir/fixtureRepository.js";
import { OperationsService } from "./operations/operationsService.js";
import { QuestionnaireService } from "./questionnaires/questionnaireService.js";
import { MemoryStore } from "./storage/memoryStore.js";
import { SubmissionService } from "./submissions/submissionService.js";

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
      if (error instanceof OperationOutcomeError) {
        sendJson(response, error.statusCode, error.outcome);
        return;
      }
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
  const questionnaireService = new QuestionnaireService(repository, store);
  const submissionService = new SubmissionService(repository, store);
  const operationsService = new OperationsService(store);

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

  if (request.method === "POST" && url.pathname === "/demo/seed-work-items") {
    const body = await readJson<{ count?: number; ownerUserId?: string }>(request);
    const count = Math.max(1, Math.min(body.count ?? 3, 10));
    const baseRequest: RequirementEvaluationRequest = {
      patientId: "patient-mri-001",
      coverageId: "coverage-acme-001",
      requestResourceType: "ServiceRequest",
      requestResourceId: "servicerequest-mri-lumbar-001",
      serviceLine: "mri_lumbar_spine",
      payerId: "acme-health"
    };
    const baseResult = evaluateRequirement(baseRequest, repository);
    const start = store.listWorkItems().length + 1;
    const created = Array.from({ length: count }, (_, index) => {
      const demoNumber = String(start + index).padStart(5, "0");
      const result = store.saveEvaluation(baseRequest, {
        ...baseResult,
        evaluationId: `eval-m4demo${demoNumber}`
      });
      return store.createWorkItem({
        evaluationId: result.evaluationId,
        ownerUserId: body.ownerUserId
      });
    });
    sendJson(response, 201, created);
    return;
  }

  if (request.method === "GET" && url.pathname === "/work-items") {
    sendJson(response, 200, operationsService.listQueue({
      status: url.searchParams.get("status") ?? undefined,
      owner: url.searchParams.get("owner") ?? undefined,
      sort: (url.searchParams.get("sort") as "age_desc" | "age_asc" | "updated_desc" | "updated_asc" | null) ?? undefined
    }));
    return;
  }

  if (request.method === "GET" && url.pathname === "/operations/metrics") {
    sendJson(response, 200, operationsService.getMetrics());
    return;
  }

  if (request.method === "POST" && url.pathname === "/dtr/package") {
    const body = await readJson<QuestionnairePackageRequest>(request);
    sendJson(response, 200, questionnaireService.getPackage(body.workItemId));
    return;
  }

  if (request.method === "POST" && url.pathname === "/dtr/save-response") {
    const body = await readJson<QuestionnaireResponseSaveRequest>(request);
    sendJson(response, 200, questionnaireService.saveResponse(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/pas/build-packet") {
    const body = await readJson<PacketBuildRequest>(request);
    sendJson(response, 200, submissionService.buildPacket(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/pas/submit") {
    const body = await readJson<PacketSubmitRequest>(request);
    sendJson(response, 200, submissionService.submitPacket(body));
    return;
  }

  const workItemStatusMatch = url.pathname.match(/^\/work-items\/([^/]+)\/status$/);
  if (request.method === "GET" && workItemStatusMatch) {
    const workItemId = decodeURIComponent(workItemStatusMatch[1]);
    if (!store.getWorkItem(workItemId)) {
      sendJson(response, 404, { error: "Work item not found" });
      return;
    }
    sendJson(response, 200, store.getStatusEvents(workItemId));
    return;
  }

  const workItemAuditMatch = url.pathname.match(/^\/work-items\/([^/]+)\/audit$/);
  if (request.method === "GET" && workItemAuditMatch) {
    const workItemId = decodeURIComponent(workItemAuditMatch[1]);
    if (!store.getWorkItem(workItemId)) {
      sendJson(response, 404, { error: "Work item not found" });
      return;
    }
    sendJson(response, 200, store.getAuditEventsForWorkItem(workItemId));
    return;
  }

  const workItemOperationsMatch = url.pathname.match(/^\/work-items\/([^/]+)\/operations$/);
  if (request.method === "GET" && workItemOperationsMatch) {
    sendJson(response, 200, operationsService.getOperationsHistory(decodeURIComponent(workItemOperationsMatch[1])));
    return;
  }

  const workItemMoreInfoMatch = url.pathname.match(/^\/work-items\/([^/]+)\/request-more-info$/);
  if (request.method === "POST" && workItemMoreInfoMatch) {
    const body = await readJson<MoreInfoRequestCreateRequest>(request);
    sendJson(response, 200, operationsService.requestMoreInfo(decodeURIComponent(workItemMoreInfoMatch[1]), body));
    return;
  }

  const workItemPayerStatusMatch = url.pathname.match(/^\/work-items\/([^/]+)\/record-payer-status$/);
  if (request.method === "POST" && workItemPayerStatusMatch) {
    const body = await readJson<PayerStatusRecordRequest>(request);
    sendJson(response, 200, operationsService.recordPayerStatus(decodeURIComponent(workItemPayerStatusMatch[1]), body));
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
