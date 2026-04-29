import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createServer } from "../apps/api/dist/server.js";
import { evaluateRequirement } from "../apps/api/dist/evaluation/evaluate.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { QuestionnaireService } from "../apps/api/dist/questionnaires/questionnaireService.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";
import { SubmissionService } from "../apps/api/dist/submissions/submissionService.js";

const goldenScenario = readJson("data/fixtures/golden-scenarios/mri-lumbar-spine.json");

function readJson(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

async function withTestServer(callback) {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const server = createServer({ repository, store });
  await new Promise((resolveServer) => server.listen(0, "127.0.0.1", resolveServer));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await callback(`http://127.0.0.1:${address.port}`, store, repository);
  } finally {
    await new Promise((resolveServer, reject) => {
      server.close((error) => error ? reject(error) : resolveServer());
    });
  }
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return {
    status: response.status,
    body: await response.json()
  };
}

function resources(bundle, resourceType) {
  return bundle.entry.filter((entry) => entry.resource.resourceType === resourceType).map((entry) => entry.resource);
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

function buildReviewReadyPacket(store, repository) {
  const result = store.saveEvaluation(goldenScenario.request, evaluateRequirement(goldenScenario.request, repository));
  const workItem = store.createWorkItem({ evaluationId: result.evaluationId, ownerUserId: "m8-test-operator" });
  const questionnaireService = new QuestionnaireService(repository, store);
  const pkg = questionnaireService.getPackage(workItem.id);
  questionnaireService.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse)),
    revision: pkg.session.revision,
    actorUserId: "m8-test-operator",
    markReadyForReview: true
  });
  return new SubmissionService(repository, store).buildPacket({
    workItemId: workItem.id,
    actorUserId: "m8-test-operator"
  });
}

test("PAS Claim submit maps generated packet Bundles through the receipt flow", async () => {
  await withTestServer(async (baseUrl, store, repository) => {
    const packet = buildReviewReadyPacket(store, repository);
    const response = await postJson(
      `${baseUrl}/fhir/Claim/$submit`,
      packet.bundle
    );
    const receipt = store.getSubmissionReceiptByPacketId(packet.id);

    assert.equal(response.status, 200);
    assert.equal(response.body.resourceType, "Bundle");
    assert.notEqual(response.body.resourceType, "Parameters");
    assert.equal(resources(response.body, "ClaimResponse").length, 1);
    assert.ok(receipt);
    assert.deepEqual(response.body, receipt.responseBundle);
  });
});

test("invalid PAS standards envelopes return OperationOutcome", async () => {
  await withTestServer(async (baseUrl) => {
    const badPas = await postJson(`${baseUrl}/fhir/Claim/$submit`, {
      resourceType: "Bundle",
      id: "missing-claim",
      type: "collection",
      entry: []
    });
    const unmappedPas = await postJson(`${baseUrl}/fhir/Claim/$submit`, readJson("data/standards/pas-claim-submit.bundle.json"));

    assert.equal(badPas.status, 422);
    assert.equal(badPas.body.resourceType, "OperationOutcome");
    assert.equal(unmappedPas.status, 422);
    assert.equal(unmappedPas.body.resourceType, "OperationOutcome");
  });
});
