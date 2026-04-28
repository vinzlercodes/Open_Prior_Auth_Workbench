import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateRequirement } from "../apps/api/dist/evaluation/evaluate.js";
import { OperationOutcomeError } from "../apps/api/dist/errors.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { QuestionnaireService } from "../apps/api/dist/questionnaires/questionnaireService.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

function createFixture() {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const result = store.saveEvaluation(
    goldenScenario.request,
    evaluateRequirement(goldenScenario.request, repository)
  );
  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "m2-test-operator"
  });
  const service = new QuestionnaireService(repository, store);

  return { repository, service, store, workItem };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
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

function assertOutcome(error, statusCode, code) {
  assert.ok(error instanceof OperationOutcomeError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.outcome.resourceType, "OperationOutcome");
  assert.equal(error.outcome.issue[0].code, code);
}

test("DTR-like package creation returns Questionnaire, draft QuestionnaireResponse, metadata, and fixture dependencies", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);

  assert.equal(pkg.workItemId, workItem.id);
  assert.ok(pkg.sessionId.startsWith("qs-"));
  assert.equal(pkg.questionnaireCanonical, "http://openpriorauth.local/fhir/Questionnaire/mri-lumbar-spine-prior-auth|2026.04");
  assert.equal(pkg.questionnaireVersion, "2026.04");
  assert.equal(pkg.questionnaire.resourceType, "Questionnaire");
  assert.equal(pkg.questionnaireResponse.resourceType, "QuestionnaireResponse");
  assert.equal(pkg.questionnaireResponse.status, "in-progress");
  assert.equal(pkg.dependencies.libraries[0].resourceType, "Library");
  assert.equal(pkg.dependencies.valueSets[0].resourceType, "ValueSet");
  assert.ok(pkg.prefill.length >= 5);
  assert.equal(pkg.validation.valid, false);
  assert.ok(pkg.completion.requiredAnswered < pkg.completion.requiredTotal);
  assert.equal(pkg.session.revision, 1);
});

test("DTR standards package is Parameters-shaped with Questionnaire first and fixture expression results", () => {
  const { service, workItem } = createFixture();
  const standardsPackage = service.getStandardsPackage(workItem.id);
  const bundle = standardsPackage.response.parameter.find((parameter) => parameter.name === "return").resource;

  assert.equal(standardsPackage.conformance, false);
  assert.equal(standardsPackage.mode, "local-non-conformant");
  assert.equal(standardsPackage.response.resourceType, "Parameters");
  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.entry[0].resource.resourceType, "Questionnaire");
  assert.ok(bundle.entry.some((entry) => entry.resource.resourceType === "Library"));
  assert.ok(bundle.entry.some((entry) => entry.resource.resourceType === "ValueSet"));
  assert.ok(bundle.entry.some((entry) => entry.resource.resourceType === "QuestionnaireResponse"));
  assert.ok(standardsPackage.expressionEvaluations.some((item) => item.expressionName === "mri.hasConservativeTherapyEvidence"));
});

test("unsupported local DTR fixture expressions fail visibly", () => {
  const { service, workItem } = createFixture();

  assert.throws(
    () => service.evaluateFixtureExpression(workItem.id, "mri.notInTheAllowlist"),
    (error) => {
      assertOutcome(error, 400, "not-supported");
      return true;
    }
  );
});

test("QuestionnaireResponse carries questionnaire canonical, patient subject, order basedOn, and work-item extension", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);

  assert.equal(pkg.questionnaireResponse.questionnaire, `${pkg.questionnaire.url}|${pkg.questionnaire.version}`);
  assert.equal(pkg.questionnaireResponse.subject.reference, `Patient/${workItem.patientId}`);
  assert.equal(pkg.questionnaireResponse.basedOn[0].reference, `${workItem.requestResourceType}/${workItem.requestResourceId}`);
  assert.equal(
    pkg.questionnaireResponse.extension.find((extension) => extension.url.endsWith("/work-item-id")).valueString,
    workItem.id
  );
});

test("repeated package calls reuse the stored draft and preserve edits", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  const response = clone(pkg.questionnaireResponse);
  setAnswer(response, "patient-name", { valueString: "Elena Rivera Edited" });

  service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: response,
    revision: pkg.session.revision,
    actorUserId: "editor-1"
  });
  const reopened = service.getPackage(workItem.id);

  assert.equal(
    reopened.questionnaireResponse.item.find((item) => item.linkId === "patient-name").answer[0].valueString,
    "Elena Rivera Edited"
  );
  assert.equal(reopened.session.prefillOverrides[0].linkId, "patient-name");
});

test("/dtr/save-response requires revision", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);

  assert.throws(
    () => service.saveResponse({
      workItemId: workItem.id,
      questionnaireResponse: pkg.questionnaireResponse
    }),
    (error) => {
      assertOutcome(error, 400, "required");
      return true;
    }
  );
});

test("saving with stale revision returns a conflict OperationOutcome", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: pkg.questionnaireResponse,
    revision: pkg.session.revision
  });

  assert.throws(
    () => service.saveResponse({
      workItemId: workItem.id,
      questionnaireResponse: pkg.questionnaireResponse,
      revision: pkg.session.revision
    }),
    (error) => {
      assertOutcome(error, 409, "conflict");
      return true;
    }
  );
});

test("saving an incomplete draft persists answers with validation errors and separate statuses", () => {
  const { service, store, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  const response = clone(pkg.questionnaireResponse);
  setAnswer(response, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: "routine",
      display: "Routine"
    }
  });

  const saved = service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: response,
    revision: pkg.session.revision
  });

  assert.equal(saved.questionnaireResponse.status, "in-progress");
  assert.equal(store.getWorkItem(workItem.id).status, "questionnaire_in_progress");
  assert.equal(saved.validation.valid, false);
  assert.ok(saved.validation.issues.some((issue) => issue.linkId === "prior-spine-surgery" && issue.rule === "required"));
});

test("mark ready fails on invalid required fields and succeeds on valid required fields", () => {
  const { service, store, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  const invalid = service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: pkg.questionnaireResponse,
    revision: pkg.session.revision,
    markReadyForReview: true
  });

  assert.equal(invalid.questionnaireResponse.status, "in-progress");
  assert.equal(store.getWorkItem(workItem.id).status, "questionnaire_in_progress");

  const validResponse = completeResponse(clone(invalid.questionnaireResponse));
  const ready = service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: validResponse,
    revision: invalid.session.revision,
    markReadyForReview: true
  });

  assert.equal(ready.validation.valid, true);
  assert.equal(ready.questionnaireResponse.status, "completed");
  assert.equal(store.getWorkItem(workItem.id).status, "review_ready");
});

test("required validation ignores disabled enableWhen items", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  const response = completeResponse(clone(pkg.questionnaireResponse));
  const saved = service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: response,
    revision: pkg.session.revision,
    markReadyForReview: true
  });

  assert.equal(saved.validation.valid, true);
  assert.ok(!saved.validation.issues.some((issue) => issue.linkId === "prior-spine-surgery-details" && issue.rule === "required"));
});

test("type validation rejects a wrong value[x]", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  const response = clone(pkg.questionnaireResponse);
  setAnswer(response, "prior-spine-surgery", { valueString: "false" });

  const saved = service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: response,
    revision: pkg.session.revision
  });

  assert.ok(saved.validation.issues.some((issue) => issue.linkId === "prior-spine-surgery" && issue.rule === "type"));
});

test("fixed-choice validation rejects answers outside answerOption", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  const response = clone(pkg.questionnaireResponse);
  setAnswer(response, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: "elective",
      display: "Elective"
    }
  });

  const saved = service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: response,
    revision: pkg.session.revision
  });

  assert.ok(saved.validation.issues.some((issue) => issue.linkId === "clinical-urgency" && issue.rule === "answer-option"));
});

test("prefill metadata identifies source resource type and id for each deterministic prefill", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  const byLinkId = new Map(pkg.prefill.map((prefill) => [prefill.linkId, prefill]));

  assert.equal(byLinkId.get("patient-name").sourceResourceType, "Patient");
  assert.equal(byLinkId.get("patient-name").sourceResourceId, "patient-mri-001");
  assert.equal(byLinkId.get("payer-name").sourceResourceType, "Coverage");
  assert.equal(byLinkId.get("requested-service").sourceResourceType, "ServiceRequest");
  assert.equal(byLinkId.get("diagnosis-summary").sourceResourceType, "Condition");
  assert.equal(byLinkId.get("conservative-treatment-evidence").sourceResourceType, "Observation");
});

test("editing a prefilled field records local override metadata outside QuestionnaireResponse", () => {
  const { service, workItem } = createFixture();
  const pkg = service.getPackage(workItem.id);
  const response = clone(pkg.questionnaireResponse);
  setAnswer(response, "payer-name", { valueString: "Acme Health Plan - corrected" });

  const saved = service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: response,
    revision: pkg.session.revision,
    actorUserId: "override-test"
  });

  assert.deepEqual(saved.questionnaireResponse.item.find((item) => item.linkId === "payer-name").answer[0], {
    valueString: "Acme Health Plan - corrected"
  });
  assert.ok(!JSON.stringify(saved.questionnaireResponse).includes("prefillOverrides"));
  assert.equal(saved.session.prefillOverrides[0].linkId, "payer-name");
  assert.equal(saved.session.prefillOverrides[0].actorUserId, "override-test");
});

test("missing questionnaire file returns a structured OperationOutcome-style error", () => {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const result = {
    ...evaluateRequirement(goldenScenario.request, repository),
    questionnaireCanonicals: ["http://openpriorauth.local/fhir/Questionnaire/missing|2026.04"]
  };
  const saved = store.saveEvaluation(goldenScenario.request, result);
  const workItem = store.createWorkItem({ evaluationId: saved.evaluationId });
  const service = new QuestionnaireService(repository, store);

  assert.throws(
    () => service.getPackage(workItem.id),
    (error) => {
      assertOutcome(error, 404, "not-found");
      return true;
    }
  );
});

test("mark ready for review does not mutate the M1 requirement evaluation result", () => {
  const { service, store, workItem } = createFixture();
  const before = JSON.stringify(store.getWorkItem(workItem.id).requirementResult);
  const pkg = service.getPackage(workItem.id);

  service.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse)),
    revision: pkg.session.revision,
    markReadyForReview: true
  });

  assert.equal(JSON.stringify(store.getWorkItem(workItem.id).requirementResult), before);
});
