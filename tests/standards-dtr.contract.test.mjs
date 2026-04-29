import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createServer } from "../apps/api/dist/server.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

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
    await callback(`http://127.0.0.1:${address.port}`);
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

test("DTR Questionnaire package returns Parameters with packagebundle collection Bundles", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await postJson(
      `${baseUrl}/fhir/Questionnaire/$questionnaire-package`,
      readJson("data/standards/dtr-questionnaire-package.parameters.json")
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.resourceType, "Parameters");
    const packageBundles = response.body.parameter.filter((parameter) => parameter.name === "packagebundle");
    assert.ok(packageBundles.length >= 1);

    for (const parameter of packageBundles) {
      assert.equal(parameter.resource.resourceType, "Bundle");
      assert.equal(parameter.resource.type, "collection");
      assert.equal(resources(parameter.resource, "Questionnaire").length, 1);
      assert.equal(resources(parameter.resource, "QuestionnaireResponse").length, 1);
      assert.equal(resources(parameter.resource, "QuestionnaireResponse")[0].status, "in-progress");
      assert.ok(resources(parameter.resource, "Library").length >= 1);
      assert.ok(resources(parameter.resource, "ValueSet").length >= 1);
    }
  });
});

test("invalid DTR standards envelopes return OperationOutcome", async () => {
  await withTestServer(async (baseUrl) => {
    const badDtr = await postJson(`${baseUrl}/fhir/Questionnaire/$questionnaire-package`, {
      resourceType: "Bundle",
      entry: []
    });
    const emptyDtr = await postJson(`${baseUrl}/fhir/Questionnaire/$questionnaire-package`, {
      resourceType: "Parameters",
      parameter: []
    });

    assert.equal(badDtr.status, 400);
    assert.equal(badDtr.body.resourceType, "OperationOutcome");
    assert.equal(emptyDtr.status, 400);
    assert.equal(emptyDtr.body.resourceType, "OperationOutcome");
  });
});
