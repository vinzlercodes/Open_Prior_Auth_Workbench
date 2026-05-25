import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  APPROVAL_EXECUTOR_REQUIRED,
  executeDoctorTool,
  getDoctorToolDefinition,
  listDoctorTools
} from "../packages/doctor-toolnet/dist/index.js";
import { evaluateRequirement, saveQuestionnaireResponse } from "../packages/prior-auth-core/dist/index.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

const expectedToolNames = [
  "doctor.case.get",
  "doctor.queue.list_work_items",
  "doctor.case.get_status_timeline",
  "doctor.case.get_audit_trace",
  "doctor.evidence.list",
  "doctor.requirements.evaluate",
  "doctor.crd.discover_services",
  "doctor.crd.invoke_service",
  "doctor.dtr.get_questionnaire_package",
  "doctor.dtr.get_questionnaire_package_fhir",
  "doctor.pas.build_packet",
  "doctor.pas.build_claim_submit_bundle",
  "doctor.dtr.save_response",
  "doctor.pas.submit_mock",
  "doctor.pas.submit_claim_fhir_mock",
  "doctor.pas.map_claim_response_to_runtime_receipt"
];

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

function createClock(start = "2026-04-25T12:00:00.000Z") {
  let current = new Date(start);
  return {
    clock: () => current,
    nowIso: () => current.toISOString(),
    advance: (ms) => {
      current = new Date(current.getTime() + ms);
    }
  };
}

function createIds() {
  let next = 0;
  return {
    generateId: (prefix = "call") => `${prefix}-${String(++next).padStart(4, "0")}`
  };
}

function createFixture() {
  const time = createClock();
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore(time.clock);
  const result = store.saveEvaluation(
    goldenScenario.request,
    evaluateRequirement(goldenScenario.request, repository)
  );
  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "toolnet-test-operator"
  });
  const dependencies = {
    repository,
    store,
    clock: time,
    idGenerator: createIds()
  };

  return { ...time, dependencies, repository, store, workItem };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readStandardFixture(fileName) {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "data/standards", fileName), "utf8")
  );
}

function serviceIdForHook(hook) {
  return `open-prior-auth-${hook}`;
}

function setAnswer(response, linkId, answer) {
  const item = response.item.find((candidate) => candidate.linkId === linkId);
  assert.ok(item, `Expected response item ${linkId}`);
  item.answer = [answer];
  return response;
}

function completeResponse(response) {
  setAnswer(response, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: "routine",
      display: "Routine"
    }
  });
  setAnswer(response, "prior-spine-surgery", { valueBoolean: false });
  return response;
}

async function execute(toolName, input, dependencies) {
  const result = await executeDoctorTool({
    toolName,
    input,
    callContext: {
      actorUserId: "toolnet-test-operator"
    }
  }, dependencies);

  assert.equal(result.record.toolName, toolName);
  assert.equal(result.record.startedAt, "2026-04-25T12:00:00.000Z");
  assert.equal(result.record.completedAt, "2026-04-25T12:00:00.000Z");
  return result;
}

test("M1b registry exposes stable metadata for executable and guarded tools", () => {
  const tools = listDoctorTools();

  assert.deepEqual(tools.map((tool) => tool.name), expectedToolNames);
  assert.equal(tools.length, 16);
  assert.equal(getDoctorToolDefinition("doctor.case.get").category, "case");
  assert.equal(getDoctorToolDefinition("doctor.case.get").riskLevel, "read");
  assert.equal(getDoctorToolDefinition("doctor.case.get").executable, true);
  assert.equal(getDoctorToolDefinition("doctor.case.get").approval.approvalRequired, false);
  assert.equal(getDoctorToolDefinition("doctor.case.get").inputSchema.properties.workItemId.type, "string");

  assert.equal(getDoctorToolDefinition("doctor.requirements.evaluate").category, "requirements");
  assert.equal(getDoctorToolDefinition("doctor.requirements.evaluate").riskLevel, "draft");
  assert.equal(getDoctorToolDefinition("doctor.crd.discover_services").category, "crd");
  assert.equal(getDoctorToolDefinition("doctor.crd.discover_services").riskLevel, "read");
  assert.equal(getDoctorToolDefinition("doctor.crd.invoke_service").riskLevel, "draft");
  assert.equal(getDoctorToolDefinition("doctor.dtr.get_questionnaire_package_fhir").riskLevel, "draft");
  assert.equal(getDoctorToolDefinition("doctor.pas.build_packet").riskLevel, "draft");
  assert.equal(getDoctorToolDefinition("doctor.pas.build_claim_submit_bundle").riskLevel, "draft");
  assert.equal(getDoctorToolDefinition("doctor.pas.map_claim_response_to_runtime_receipt").riskLevel, "read");

  const saveResponse = getDoctorToolDefinition("doctor.dtr.save_response");
  assert.equal(saveResponse.executable, false);
  assert.equal(saveResponse.riskLevel, "guarded_write");
  assert.equal(saveResponse.approval.approvalRequired, true);
  assert.equal(saveResponse.approval.blockedCode, APPROVAL_EXECUTOR_REQUIRED);

  const submitMock = getDoctorToolDefinition("doctor.pas.submit_mock");
  assert.equal(submitMock.executable, false);
  assert.equal(submitMock.riskLevel, "guarded_submit");
  assert.equal(submitMock.approval.approvalRequired, true);
  assert.equal(submitMock.approval.blockedCode, APPROVAL_EXECUTOR_REQUIRED);

  const submitClaim = getDoctorToolDefinition("doctor.pas.submit_claim_fhir_mock");
  assert.equal(submitClaim.executable, false);
  assert.equal(submitClaim.riskLevel, "guarded_submit");
  assert.equal(submitClaim.approval.approvalRequired, true);
  assert.equal(submitClaim.approval.blockedCode, APPROVAL_EXECUTOR_REQUIRED);
});

test("executable tools call prior-auth-core directly over existing adapters", async () => {
  const fixture = createFixture();
  const { dependencies, store, workItem } = fixture;

  const caseResult = await execute("doctor.case.get", { workItemId: workItem.id }, dependencies);
  assert.equal(caseResult.ok, true);
  assert.equal(caseResult.output.id, workItem.id);
  assert.equal(caseResult.record.status, "succeeded");
  assert.equal(caseResult.record.callId, "tool-call-0001");

  const queueResult = await execute("doctor.queue.list_work_items", {
    query: { owner: "toolnet-test-operator" }
  }, dependencies);
  assert.equal(queueResult.output[0].workItemId, workItem.id);

  const statusResult = await execute("doctor.case.get_status_timeline", { workItemId: workItem.id }, dependencies);
  assert.equal(statusResult.output[0].workItemId, workItem.id);

  const auditResult = await execute("doctor.case.get_audit_trace", { workItemId: workItem.id }, dependencies);
  assert.ok(auditResult.output.some((event) => event.action === "work_item.created"));

  const evidenceResult = await execute("doctor.evidence.list", { workItemId: workItem.id }, dependencies);
  assert.equal(evidenceResult.output.workItemId, workItem.id);

  const evaluationResult = await execute("doctor.requirements.evaluate", {
    request: {
      ...goldenScenario.request,
      requestResourceId: "servicerequest-mri-lumbar-001"
    }
  }, dependencies);
  assert.equal(evaluationResult.output.evaluationStatus, "requirements_found");
  assert.ok(store.getRequirementRun(evaluationResult.output.evaluationId));

  const packageResult = await execute("doctor.dtr.get_questionnaire_package", { workItemId: workItem.id }, dependencies);
  assert.equal(packageResult.output.workItemId, workItem.id);
  assert.equal(packageResult.output.questionnaire.resourceType, "Questionnaire");

  saveQuestionnaireResponse({
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(packageResult.output.questionnaireResponse)),
    revision: packageResult.output.session.revision,
    actorUserId: "toolnet-test-operator",
    markReadyForReview: true
  }, fixture.repository, store);

  const packetResult = await execute("doctor.pas.build_packet", {
    workItemId: workItem.id,
    actorUserId: "toolnet-test-operator"
  }, dependencies);
  assert.equal(packetResult.output.workItemId, workItem.id);
  assert.equal(packetResult.output.bundle.resourceType, "Bundle");
  assert.equal(store.getWorkItem(workItem.id).status, "packet_ready");
});

test("standards-shaped CRD tools expose non-conformant services and invoke fixture requests", async () => {
  const fixture = createFixture();
  const { dependencies } = fixture;

  const discovery = await execute("doctor.crd.discover_services", {}, dependencies);
  assert.equal(discovery.ok, true);
  assert.equal(discovery.output.conformance, false);
  assert.equal(discovery.output.productionConformance, false);
  assert.deepEqual(discovery.output.services.map((service) => service.hook), [
    "order-sign",
    "appointment-book",
    "order-dispatch"
  ]);

  for (const fileName of [
    "crd-order-sign.request.json",
    "crd-appointment-book.request.json",
    "crd-order-dispatch.request.json"
  ]) {
    const request = readStandardFixture(fileName);
    const result = await execute("doctor.crd.invoke_service", {
      serviceId: serviceIdForHook(request.hook),
      request
    }, dependencies);
    assert.equal(result.ok, true);
    assert.equal(result.output.conformance, false);
    assert.equal(result.output.productionConformance, false);
    assert.equal(result.output.mode, "local-non-conformant");
    assert.equal(result.output.cards[0].extension.boundary, "crd");
    assert.equal(result.output.cards[0].extension.requirementEvaluation.evaluationStatus, "requirements_found");
  }
});

test("standards-shaped DTR and PAS build tools return FHIR operation-shaped payloads", async () => {
  const fixture = createFixture();
  const { dependencies, repository, store, workItem } = fixture;

  const dtr = await execute("doctor.dtr.get_questionnaire_package_fhir", { workItemId: workItem.id }, dependencies);
  assert.equal(dtr.ok, true);
  assert.equal(dtr.output.conformance, false);
  assert.equal(dtr.output.productionConformance, false);
  assert.equal(dtr.output.operation, "Questionnaire/$questionnaire-package");
  assert.equal(dtr.output.response.resourceType, "Parameters");
  const returnBundle = dtr.output.response.parameter.find((parameter) => parameter.name === "return").resource;
  assert.equal(returnBundle.resourceType, "Bundle");
  assert.ok(returnBundle.entry.some((entry) => entry.resource.resourceType === "Questionnaire"));
  assert.ok(returnBundle.entry.some((entry) => entry.resource.resourceType === "QuestionnaireResponse"));

  const localPackage = await execute("doctor.dtr.get_questionnaire_package", { workItemId: workItem.id }, dependencies);
  saveQuestionnaireResponse({
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(localPackage.output.questionnaireResponse)),
    revision: localPackage.output.session.revision,
    actorUserId: "toolnet-test-operator",
    markReadyForReview: true
  }, repository, store);

  const pas = await execute("doctor.pas.build_claim_submit_bundle", {
    workItemId: workItem.id,
    actorUserId: "toolnet-test-operator"
  }, dependencies);
  assert.equal(pas.ok, true);
  assert.equal(pas.output.conformance, false);
  assert.equal(pas.output.productionConformance, false);
  assert.equal(pas.output.operation, "Claim/$submit");
  assert.equal(pas.output.claimSubmitBundle.resourceType, "Bundle");
  const claim = pas.output.claimSubmitBundle.entry.find((entry) => entry.resource.resourceType === "Claim").resource;
  assert.equal(claim.use, "preauthorization");

  const mapped = await execute("doctor.pas.map_claim_response_to_runtime_receipt", {
    packetId: pas.output.packet.id,
    claimResponseBundle: {
      resourceType: "Bundle",
      id: "bundle-claimresponse-test",
      type: "collection",
      entry: [
        {
          resource: {
            resourceType: "ClaimResponse",
            id: "claimresponse-test",
            preAuthRef: "mock-pas-test",
            created: "2026-04-25T12:00:00.000Z"
          }
        }
      ]
    }
  }, dependencies);
  assert.equal(mapped.ok, true);
  assert.equal(mapped.output.receipt.packetId, pas.output.packet.id);
  assert.equal(mapped.output.receipt.receiptId, "claimresponse-test");
  assert.equal(mapped.output.receipt.trackingId, "mock-pas-test");
});

test("guarded tools return deterministic approval error and do not mutate state", async () => {
  const fixture = createFixture();
  const { dependencies, store, workItem } = fixture;
  const packageResult = await execute("doctor.dtr.get_questionnaire_package", { workItemId: workItem.id }, dependencies);
  const sessionBefore = clone(store.getQuestionnaireSessionsForWorkItem(workItem.id)[0]);
  const statusBefore = store.getWorkItem(workItem.id).status;
  const receiptsBefore = store.getSubmissionReceiptsForWorkItem(workItem.id);

  const guardedSave = await execute("doctor.dtr.save_response", {
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(packageResult.output.questionnaireResponse)),
    revision: packageResult.output.session.revision,
    actorUserId: "toolnet-test-operator",
    markReadyForReview: true
  }, dependencies);

  assert.equal(guardedSave.ok, false);
  assert.equal(guardedSave.error.code, APPROVAL_EXECUTOR_REQUIRED);
  assert.equal(guardedSave.record.status, "blocked");
  assert.deepEqual(store.getQuestionnaireSessionsForWorkItem(workItem.id)[0], sessionBefore);
  assert.equal(store.getWorkItem(workItem.id).status, statusBefore);

  const guardedSubmit = await execute("doctor.pas.submit_mock", {
    packetId: "packet-not-submitted",
    actorUserId: "toolnet-test-operator"
  }, dependencies);

  assert.equal(guardedSubmit.ok, false);
  assert.equal(guardedSubmit.error.code, APPROVAL_EXECUTOR_REQUIRED);
  assert.equal(guardedSubmit.record.status, "blocked");
  assert.deepEqual(store.getSubmissionReceiptsForWorkItem(workItem.id), receiptsBefore);

  const guardedClaimSubmit = await execute("doctor.pas.submit_claim_fhir_mock", {
    packetId: "packet-not-submitted",
    actorUserId: "toolnet-test-operator",
    claimSubmitBundle: readStandardFixture("pas-claim-submit.bundle.json")
  }, dependencies);

  assert.equal(guardedClaimSubmit.ok, false);
  assert.equal(guardedClaimSubmit.error.code, APPROVAL_EXECUTOR_REQUIRED);
  assert.equal(guardedClaimSubmit.record.status, "blocked");
  assert.deepEqual(store.getSubmissionReceiptsForWorkItem(workItem.id), receiptsBefore);
});

test("ToolNet source does not import app adapters or internal HTTP boundaries", () => {
  const toolnetSource = sourceFiles(resolve(process.cwd(), "packages/doctor-toolnet/src"))
    .filter((path) => path.endsWith(".ts"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  const coreSource = sourceFiles(resolve(process.cwd(), "packages/prior-auth-core/src"))
    .filter((path) => path.endsWith(".ts"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  for (const forbidden of ["apps/api", "../apps", "localhost", "127.0.0.1", "fetch(", "http.request", "https.request"]) {
    assert.ok(!toolnetSource.includes(forbidden), `ToolNet source must not include ${forbidden}`);
  }
  assert.ok(!coreSource.includes("doctor-toolnet"));
});
