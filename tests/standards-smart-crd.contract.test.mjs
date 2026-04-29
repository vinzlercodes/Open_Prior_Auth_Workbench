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

async function getJson(url) {
  const response = await fetch(url);
  return {
    status: response.status,
    body: await response.json()
  };
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

function assertCoverageInformationSystemAction(response) {
  assert.equal(response.body.conformance, false);
  assert.equal(response.body.productionConformance, false);
  assert.deepEqual(response.body.cards, []);
  assert.equal(response.body.systemActions.length, 1);
  const resource = response.body.systemActions[0].resource;
  assert.equal(resource.resourceType, "CoverageEligibilityResponse");
  assert.ok(resource.extension.some((extension) => extension.url.includes("ext-coverage-information")));
}

test("SMART discovery is available at the FHIR base and root aliases", async () => {
  await withTestServer(async (baseUrl) => {
    const fhirBase = await getJson(`${baseUrl}/fhir/.well-known/smart-configuration`);
    const rootAlias = await getJson(`${baseUrl}/.well-known/smart-configuration`);

    assert.equal(fhirBase.status, 200);
    assert.equal(rootAlias.status, 200);
    assert.equal(fhirBase.body.productionConformance, false);
    assert.match(fhirBase.body.authorization_endpoint, /\/smart\/authorize$/);
    assert.match(fhirBase.body.token_endpoint, /\/smart\/token$/);
    assert.deepEqual(rootAlias.body, fhirBase.body);
  });
});

test("CDS discovery advertises all primary CRD hook services", async () => {
  await withTestServer(async (baseUrl) => {
    const response = await getJson(`${baseUrl}/cds-services`);
    const ids = response.body.services.map((service) => service.id).sort();

    assert.equal(response.status, 200);
    assert.equal(response.body.productionConformance, false);
    assert.deepEqual(ids, [
      "open-prior-auth-appointment-book",
      "open-prior-auth-order-dispatch",
      "open-prior-auth-order-sign"
    ]);
  });
});

test("CRD primary hooks return coverage information in systemActions, not cards", async () => {
  await withTestServer(async (baseUrl) => {
    const cases = [
      ["open-prior-auth-appointment-book", "data/standards/crd-appointment-book.request.json"],
      ["open-prior-auth-order-dispatch", "data/standards/crd-order-dispatch.request.json"],
      ["open-prior-auth-order-sign", "data/standards/crd-order-sign.request.json"]
    ];

    for (const [serviceId, fixturePath] of cases) {
      const response = await postJson(`${baseUrl}/cds-services/${serviceId}`, readJson(fixturePath));
      assert.equal(response.status, 200);
      assertCoverageInformationSystemAction(response);
    }
  });
});

test("invalid CRD standards envelopes return OperationOutcome", async () => {
  await withTestServer(async (baseUrl) => {
    const badCrd = await postJson(`${baseUrl}/cds-services/open-prior-auth-order-sign`, {
      hook: "appointment-book",
      hookInstance: "wrong-hook",
      context: {}
    });
    const emptyCrd = await postJson(`${baseUrl}/cds-services/open-prior-auth-order-sign`, {
      hook: "order-sign",
      hookInstance: "missing-required-fields",
      context: {}
    });

    assert.equal(badCrd.status, 422);
    assert.equal(badCrd.body.resourceType, "OperationOutcome");
    assert.equal(emptyCrd.status, 400);
    assert.equal(emptyCrd.body.resourceType, "OperationOutcome");
  });
});
