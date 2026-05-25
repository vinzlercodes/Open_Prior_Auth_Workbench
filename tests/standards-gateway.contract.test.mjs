import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createServer } from "../apps/api/dist/server.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";
import {
  evaluateRequirement,
  saveQuestionnaireResponse
} from "../packages/prior-auth-core/dist/index.js";

const goldenScenario = readJsonFile("data/fixtures/golden-scenarios/mri-lumbar-spine.json");
const smartDiscovery = readJsonFile("data/standards/smart-discovery.local.json");

function readJsonFile(path) {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

function readStandardFixture(fileName) {
  return readJsonFile(`data/standards/${fileName}`);
}

function createFixture() {
  const repository = new FixtureFhirRepository(goldenScenario.bundlePath);
  const store = new MemoryStore();
  const result = store.saveEvaluation(
    goldenScenario.request,
    evaluateRequirement(goldenScenario.request, repository)
  );
  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "m7-gateway-test-operator"
  });

  return { repository, store, workItem };
}

async function withTestServer(fixture, callback) {
  const server = createServer({
    repository: fixture.repository,
    store: fixture.store
  });

  await new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", resolveServer);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolveServer, reject) => {
      server.close((error) => error ? reject(error) : resolveServer());
    });
  }
}

async function getJson(baseUrl, path, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`);
  const json = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(json));
  return json;
}

async function postJson(baseUrl, path, body, expectedStatus = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  assert.equal(response.status, expectedStatus, JSON.stringify(json));
  return json;
}

function serviceIdForHook(hook) {
  return `open-prior-auth-${hook}`;
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

function assertOperationOutcome(outcome, code) {
  assert.equal(outcome.resourceType, "OperationOutcome");
  assert.equal(outcome.issue[0].severity, "error");
  assert.equal(outcome.issue[0].code, code);
}

test("M7 SMART gateway discovery matches the local non-conformant fixture", async () => {
  const fixture = createFixture();

  await withTestServer(fixture, async (baseUrl) => {
    const discovery = await getJson(baseUrl, "/fhir/.well-known/smart-configuration");
    const legacy = await getJson(baseUrl, "/.well-known/smart-configuration");

    assert.deepEqual(discovery, smartDiscovery);
    assert.equal(legacy.conformance, false);
    assert.equal(legacy.mode, "local-non-conformant");
  });
});

test("M7 CDS gateway discovers and invokes CRD primary hook services", async () => {
  const fixture = createFixture();

  await withTestServer(fixture, async (baseUrl) => {
    const discovery = await getJson(baseUrl, "/cds-services");

    assert.equal(discovery.conformance, false);
    assert.equal(discovery.productionConformance, false);
    assert.deepEqual(discovery.services.map((service) => service.hook), [
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
      const result = await postJson(baseUrl, `/cds-services/${serviceIdForHook(request.hook)}`, request);

      assert.equal(result.conformance, false);
      assert.equal(result.productionConformance, false);
      assert.equal(result.mode, "local-non-conformant");
      assert.equal(result.cards[0].extension.boundary, "crd");
      assert.equal(result.cards[0].extension.requirementEvaluation.evaluationStatus, "requirements_found");
    }
  });
});

test("M7 CDS gateway returns OperationOutcome errors for invalid fixture calls", async () => {
  const fixture = createFixture();

  await withTestServer(fixture, async (baseUrl) => {
    const orderSign = readStandardFixture("crd-order-sign.request.json");
    const orderDispatch = readStandardFixture("crd-order-dispatch.request.json");
    const missingContext = clone(orderSign);
    delete missingContext.context.patientId;

    assertOperationOutcome(
      await postJson(baseUrl, "/cds-services/not-a-service", orderSign, 404),
      "not-found"
    );
    assertOperationOutcome(
      await postJson(baseUrl, "/cds-services/open-prior-auth-order-sign", orderDispatch, 400),
      "invalid"
    );
    assertOperationOutcome(
      await postJson(baseUrl, "/cds-services/open-prior-auth-order-sign", missingContext, 400),
      "required"
    );
    assertOperationOutcome(
      await getJson(baseUrl, "/not-a-route", 404),
      "not-found"
    );
  });
});

test("M7 DTR gateway returns Questionnaire package output for workItem and Parameters inputs", async () => {
  const fixture = createFixture();

  await withTestServer(fixture, async (baseUrl) => {
    const byWorkItem = await postJson(baseUrl, "/fhir/Questionnaire/$questionnaire-package", {
      workItemId: fixture.workItem.id
    });
    const byParameters = await postJson(
      baseUrl,
      "/fhir/Questionnaire/$questionnaire-package",
      readStandardFixture("dtr-questionnaire-package.parameters.json")
    );
    const missing = await postJson(baseUrl, "/fhir/Questionnaire/$questionnaire-package", {
      resourceType: "Parameters",
      parameter: []
    }, 400);

    for (const result of [byWorkItem, byParameters]) {
      assert.equal(result.conformance, false);
      assert.equal(result.productionConformance, false);
      assert.equal(result.boundary, "dtr");
      assert.equal(result.operation, "Questionnaire/$questionnaire-package");
      assert.equal(result.response.resourceType, "Parameters");
      const returnBundle = result.response.parameter.find((parameter) => parameter.name === "return").resource;
      assert.equal(returnBundle.resourceType, "Bundle");
      assert.ok(returnBundle.entry.some((entry) => entry.resource.resourceType === "Questionnaire"));
      assert.ok(returnBundle.entry.some((entry) => entry.resource.resourceType === "QuestionnaireResponse"));
    }
    assertOperationOutcome(missing, "invalid");
  });
});

test("M7 PAS gateway submits a local packet and returns a ClaimResponse Bundle", async () => {
  const fixture = createFixture();

  await withTestServer(fixture, async (baseUrl) => {
    const dtr = await postJson(baseUrl, "/dtr/package", { workItemId: fixture.workItem.id });
    await postJson(baseUrl, "/dtr/save-response", {
      workItemId: fixture.workItem.id,
      questionnaireResponse: completeResponse(clone(dtr.questionnaireResponse)),
      revision: dtr.session.revision,
      actorUserId: "m7-gateway-test-operator",
      markReadyForReview: true
    });
    const packet = await postJson(baseUrl, "/pas/build-packet", {
      workItemId: fixture.workItem.id,
      actorUserId: "m7-gateway-test-operator"
    });
    const result = await postJson(baseUrl, "/fhir/Claim/$submit", {
      packetId: packet.id,
      actorUserId: "m7-gateway-test-operator",
      claimSubmitBundle: readStandardFixture("pas-claim-submit.bundle.json")
    });

    assert.equal(result.conformance, false);
    assert.equal(result.productionConformance, false);
    assert.equal(result.boundary, "pas");
    assert.equal(result.operation, "Claim/$submit");
    assert.equal(result.receipt.packetId, packet.id);
    assert.equal(result.claimResponseBundle.resourceType, "Bundle");
    assert.ok(result.claimResponseBundle.entry.some((entry) => entry.resource.resourceType === "ClaimResponse"));
  });
});

test("M7 legacy standards aliases remain locally non-conformant", async () => {
  const fixture = createFixture();

  await withTestServer(fixture, async (baseUrl) => {
    const boundaries = await getJson(baseUrl, "/standards/boundaries");
    const crd = await postJson(baseUrl, "/crd/evaluate", goldenScenario.request);
    const dtr = await postJson(baseUrl, "/dtr/questionnaire-package", { workItemId: fixture.workItem.id });

    assert.equal(boundaries.conformance, false);
    assert.ok(boundaries.boundaries.every((boundary) => boundary.conformance === false));
    assert.equal(crd.conformance, false);
    assert.equal(crd.boundary, "crd");
    assert.equal(dtr.conformance, false);
    assert.equal(dtr.response.resourceType, "Parameters");
  });
});
