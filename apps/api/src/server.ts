import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from "node:http";
import { URL } from "node:url";
import {
  runDeterministicPriorAuthAgentTeam,
  SqliteRuntimeStore,
  type ApprovalRequest
} from "@open-prior-auth/doctor-runtime";
import type {
  AgentCockpitApprovalSummary,
  AgentCockpitRequirementEvidenceRow,
  AgentCockpitRunResponse,
  AttachEvidenceRequest,
  EvidenceListResponse,
  MoreInfoRequestCreateRequest,
  PacketBuildRequest,
  PacketSubmitRequest,
  PayerStatusRecordRequest,
  QuestionnairePackageRequest,
  QuestionnaireResponseSaveRequest,
  RequirementEvaluationRequest,
  UploadEvidenceRequest,
  WorkItemCreateRequest
} from "@open-prior-auth/shared-types";
import {
  buildSubmissionPacket,
  evaluateRequirements,
  EvidenceRepository,
  findRulePackForRequest,
  getCaseAuditTrace,
  getCaseStatusTimeline,
  getPriorAuthorizationCase,
  getQuestionnairePackage,
  listEvidence,
  listWorkItems,
  OperationOutcomeError,
  OperationsService,
  saveQuestionnaireResponse,
  submitMockPacket,
  type PriorAuthStore
} from "@open-prior-auth/prior-auth-core";
import { createLocalStandardsAdapters, type LocalStandardsAdapters } from "./adapters/localStandardsAdapters.js";
import { FixtureFhirRepository } from "./fhir/fixtureRepository.js";
import { getGoldenScenario, listGoldenScenarios } from "./scenarios.js";
import { defaultDatabasePath, SqliteStore } from "./storage/sqliteStore.js";

export interface ApiDependencies {
  repository?: FixtureFhirRepository;
  store?: PriorAuthStore;
  runtimeStorePath?: string;
}

export function createServer(dependencies: ApiDependencies = {}) {
  const repository = dependencies.repository ?? new FixtureFhirRepository();
  const store = dependencies.store ?? new SqliteStore();
  const adapters = createLocalStandardsAdapters(repository, store);

  return createHttpServer(async (request, response) => {
    try {
      await routeRequest(request, response, repository, store, adapters, dependencies.runtimeStorePath);
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
  store: PriorAuthStore,
  adapters: LocalStandardsAdapters,
  runtimeStorePath: string | undefined
): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const operationsService = new OperationsService(store);
  const evidenceRepository = new EvidenceRepository(store);

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

  if (request.method === "GET" && url.pathname === "/standards/boundaries") {
    sendJson(response, 200, adapters.boundaries());
    return;
  }

  if (request.method === "GET" && url.pathname === "/.well-known/smart-configuration") {
    sendJson(response, 200, adapters.launch.smartConfiguration());
    return;
  }

  if (request.method === "GET" && url.pathname === "/smart/launch") {
    sendJson(response, 200, adapters.launch.resolveLaunchContext({
      patientId: url.searchParams.get("patient") ?? undefined
    }));
    return;
  }

  if (request.method === "POST" && url.pathname === "/smart/token") {
    const body = await readJson<{ patientId?: string }>(request);
    sendJson(response, 200, adapters.launch.resolveLaunchContext({ patientId: body.patientId }));
    return;
  }

  const contextMatch = url.pathname.match(/^\/context\/patient\/([^/]+)$/);
  if (request.method === "GET" && contextMatch) {
    sendJson(response, 200, adapters.launch.getPatientContext(
      decodeURIComponent(contextMatch[1]),
      url.searchParams.get("coverageId") ?? undefined,
      url.searchParams.get("requestResourceType") ?? undefined,
      url.searchParams.get("requestResourceId") ?? undefined
    ));
    return;
  }

  if (request.method === "POST" && url.pathname === "/requirements/evaluate") {
    const body = await readJson<RequirementEvaluationRequest>(request);
    sendJson(response, 200, evaluateRequirements(body, repository, store));
    return;
  }

  if (request.method === "POST" && url.pathname === "/crd/evaluate") {
    const body = await readJson<RequirementEvaluationRequest>(request);
    sendJson(response, 200, adapters.crd.evaluateCoverageRequirements(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/work-items") {
    const body = await readJson<WorkItemCreateRequest>(request);
    sendJson(response, 201, store.createWorkItem(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/agent-runs/prior-auth-deterministic") {
    const body = await readJson<{ workItemId: string; actorUserId?: string }>(request);
    sendJson(response, 200, await runPriorAuthCockpitAgent(body, repository, store, runtimeStorePath));
    return;
  }

  if (request.method === "GET" && url.pathname === "/demo/scenarios") {
    sendJson(response, 200, listGoldenScenarios().map((scenario) => ({
      scenarioId: scenario.scenarioId,
      publicName: scenario.publicName ?? scenario.description,
      request: scenario.request
    })));
    return;
  }

  if (request.method === "POST" && url.pathname === "/demo/seed-work-items") {
    const body = await readJson<{ count?: number; ownerUserId?: string; scenarioId?: string }>(request);
    const count = Math.max(1, Math.min(body.count ?? 3, 10));
    const baseRequest = getGoldenScenario(body.scenarioId).request;
    const baseResult = evaluateRequirements(baseRequest, repository);
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
    sendJson(response, 200, listWorkItems(store, {
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
    sendJson(response, 200, getQuestionnairePackage(body, repository, store));
    return;
  }

  if (request.method === "POST" && url.pathname === "/dtr/questionnaire-package") {
    const body = await readJson<QuestionnairePackageRequest>(request);
    sendJson(response, 200, adapters.dtr.getStandardsPackage(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/dtr/evaluate-fixture-expression") {
    const body = await readJson<{ workItemId: string; expressionName: string }>(request);
    sendJson(response, 200, adapters.dtr.evaluateFixtureExpression(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/dtr/save-response") {
    const body = await readJson<QuestionnaireResponseSaveRequest>(request);
    sendJson(response, 200, saveQuestionnaireResponse(body, repository, store));
    return;
  }

  if (request.method === "POST" && url.pathname === "/pas/build-packet") {
    const body = await readJson<PacketBuildRequest>(request);
    sendJson(response, 200, buildSubmissionPacket(body, repository, store));
    return;
  }

  if (request.method === "POST" && url.pathname === "/pas/build-submission") {
    const body = await readJson<PacketBuildRequest>(request);
    sendJson(response, 200, adapters.pas.buildSubmission(body));
    return;
  }

  if (request.method === "POST" && url.pathname === "/pas/submit") {
    const body = await readJson<PacketSubmitRequest>(request);
    sendJson(response, 200, submitMockPacket(body, repository, store));
    return;
  }

  if (request.method === "POST" && url.pathname === "/pas/submit-local") {
    const body = await readJson<PacketSubmitRequest>(request);
    sendJson(response, 200, adapters.pas.submit(body));
    return;
  }

  const evidenceMatch = url.pathname.match(/^\/work-items\/([^/]+)\/evidence$/);
  if (request.method === "GET" && evidenceMatch) {
    sendJson(response, 200, listEvidence(decodeURIComponent(evidenceMatch[1]), store));
    return;
  }

  const attachFixtureMatch = url.pathname.match(/^\/work-items\/([^/]+)\/evidence\/attach-fixture$/);
  if (request.method === "POST" && attachFixtureMatch) {
    const body = await readJson<AttachEvidenceRequest>(request);
    sendJson(response, 201, evidenceRepository.attachFixture(decodeURIComponent(attachFixtureMatch[1]), body));
    return;
  }

  const uploadEvidenceMatch = url.pathname.match(/^\/work-items\/([^/]+)\/evidence\/upload$/);
  if (request.method === "POST" && uploadEvidenceMatch) {
    const body = await readJson<UploadEvidenceRequest>(request);
    sendJson(response, 201, evidenceRepository.uploadEvidence(decodeURIComponent(uploadEvidenceMatch[1]), body));
    return;
  }

  const acceptEvidenceMatch = url.pathname.match(/^\/work-items\/([^/]+)\/evidence\/([^/]+)\/accept$/);
  if (request.method === "POST" && acceptEvidenceMatch) {
    const body = await readJson<{ actorUserId?: string }>(request);
    sendJson(response, 200, evidenceRepository.acceptEvidence(
      decodeURIComponent(acceptEvidenceMatch[1]),
      decodeURIComponent(acceptEvidenceMatch[2]),
      body.actorUserId
    ));
    return;
  }

  const removeEvidenceMatch = url.pathname.match(/^\/work-items\/([^/]+)\/evidence\/([^/]+)\/remove$/);
  if (request.method === "POST" && removeEvidenceMatch) {
    const body = await readJson<{ actorUserId?: string }>(request);
    sendJson(response, 200, evidenceRepository.removeEvidence(
      decodeURIComponent(removeEvidenceMatch[1]),
      decodeURIComponent(removeEvidenceMatch[2]),
      body.actorUserId
    ));
    return;
  }

  const workItemStatusMatch = url.pathname.match(/^\/work-items\/([^/]+)\/status$/);
  if (request.method === "GET" && workItemStatusMatch) {
    sendJson(response, 200, getCaseStatusTimeline(decodeURIComponent(workItemStatusMatch[1]), store));
    return;
  }

  const workItemAuditMatch = url.pathname.match(/^\/work-items\/([^/]+)\/audit$/);
  if (request.method === "GET" && workItemAuditMatch) {
    sendJson(response, 200, getCaseAuditTrace(decodeURIComponent(workItemAuditMatch[1]), store));
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
    sendJson(response, 200, getPriorAuthorizationCase(decodeURIComponent(workItemMatch[1]), store).workItem);
    return;
  }

  sendJson(response, 404, { error: "Route not found" });
}

async function runPriorAuthCockpitAgent(
  input: { workItemId: string; actorUserId?: string },
  repository: FixtureFhirRepository,
  store: PriorAuthStore,
  runtimeStorePath: string | undefined
): Promise<AgentCockpitRunResponse> {
  if (!input.workItemId) {
    throw new OperationOutcomeError(400, "required", "workItemId is required.");
  }

  const runtimeStore = new SqliteRuntimeStore(runtimeStorePath ?? defaultDatabasePath());
  try {
    const result = await runDeterministicPriorAuthAgentTeam({
      workItemId: input.workItemId,
      actorUserId: input.actorUserId ?? "m5-cockpit-operator",
      questionnaireApprovalActorUserId: "m5-scripted-approver"
    }, {
      runtimeStore,
      toolDependencies: {
        repository,
        store
      }
    });
    const caseRoot = getPriorAuthorizationCase(result.workItemId, store);
    const questionnairePackage = getQuestionnairePackage({ workItemId: result.workItemId }, repository, store);
    const evidence = listEvidence(result.workItemId, store);

    return {
      run: result.run,
      workItem: caseRoot.workItem,
      caseStatus: caseRoot.lifecycleStatus,
      requirementEvaluation: result.requirementEvaluation,
      questionnairePackage,
      evidence,
      evidenceBoard: buildEvidenceBoard(caseRoot.workItem, evidence),
      packet: result.packet,
      receipt: caseRoot.submissionReceipts.at(-1) ?? null,
      questionnaireApproval: summarizeApproval(result.questionnaireApprovalRequest),
      submitApproval: summarizeApproval(result.submitApprovalRequest),
      steps: result.steps,
      trace: result.trace,
      statusTimeline: caseRoot.statusTimeline,
      auditTrace: caseRoot.auditTrace
    };
  } finally {
    runtimeStore.close();
  }
}

function summarizeApproval(approval: ApprovalRequest): AgentCockpitApprovalSummary {
  return {
    id: approval.id,
    toolName: approval.toolName,
    riskLevel: approval.riskLevel,
    status: approval.status,
    reason: approval.reason,
    requestedBy: approval.requestedBy,
    requestedAt: approval.requestedAt,
    decidedBy: approval.decision?.decidedBy,
    decidedAt: approval.decision?.decidedAt,
    decisionReason: approval.decision?.reason
  };
}

function buildEvidenceBoard(
  workItem: Awaited<ReturnType<typeof getPriorAuthorizationCase>>["workItem"],
  evidence: EvidenceListResponse
): AgentCockpitRequirementEvidenceRow[] {
  const rulePack = findRulePackForRequest({
    payerId: workItem.payerId,
    serviceLine: workItem.serviceLine
  });
  const requirements = rulePack?.rules[0]?.requiredClinicalContext ?? workItem.requirementResult.missingData;

  return requirements.map((requirement) => {
    const matchingAttachments = evidence.attachments.filter((attachment) =>
      evidenceMatchesRequirement(attachment.title, attachment.filename, requirement.code, requirement.resourceType)
    );
    const matchingFixtures = evidence.availableFixtures.filter((fixture) =>
      evidenceMatchesRequirement(fixture.title, fixture.filename, requirement.code, requirement.resourceType)
    );
    const packetAttachments = matchingAttachments.filter((attachment) => attachment.status === "included-in-packet");
    const acceptedAttachments = matchingAttachments.filter((attachment) => attachment.status === "accepted");
    const attachedAttachments = matchingAttachments.filter((attachment) => attachment.status === "attached");
    const missing = workItem.requirementResult.missingData.some((item) => item.code === requirement.code);

    return {
      requirementCode: requirement.code,
      requirementLabel: requirement.label,
      requirementDetail: requirement.detail,
      resourceType: requirement.resourceType,
      status: packetAttachments.length > 0
        ? "included-in-packet"
        : acceptedAttachments.length > 0
          ? "accepted"
          : attachedAttachments.length > 0
            ? "attached"
            : missing
              ? "missing"
              : matchingFixtures.length > 0
                ? "available"
                : "satisfied",
      sourceLabel: sourceLabelForRequirement(requirement.resourceType, workItem.requirementResult.requestSummary),
      evidenceAttachmentIds: matchingAttachments.map((attachment) => attachment.id),
      fixtureIds: matchingFixtures.map((fixture) => fixture.fixtureId)
    };
  });
}

function evidenceMatchesRequirement(
  title: string,
  filename: string,
  requirementCode: string,
  resourceType: string
): boolean {
  if (resourceType === "Condition") {
    return false;
  }
  const haystack = `${title} ${filename}`.toLowerCase();
  if (requirementCode.includes("conservative")) {
    return haystack.includes("conservative") || haystack.includes("mri");
  }
  if (requirementCode.includes("functional") || requirementCode.includes("mobility")) {
    return haystack.includes("mobility") || haystack.includes("wheelchair") || haystack.includes("dme");
  }
  return false;
}

function sourceLabelForRequirement(
  resourceType: string,
  summary: { diagnosisSummary?: string; evidenceSummary?: string }
): string {
  if (resourceType === "Condition") {
    return summary.diagnosisSummary ?? "No diagnosis context loaded";
  }
  if (resourceType === "Observation") {
    return summary.evidenceSummary ?? "No observation context loaded";
  }
  return "No source context loaded";
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
