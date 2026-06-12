import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createServer } from "../apps/api/dist/server.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);

function createFixture() {
  return {
    repository: new FixtureFhirRepository(goldenScenario.bundlePath),
    store: new MemoryStore()
  };
}

async function withExecutionMode(mode, callback) {
  const previous = process.env.OPEN_PRIOR_AUTH_EXECUTION_MODE;
  if (mode === undefined) {
    delete process.env.OPEN_PRIOR_AUTH_EXECUTION_MODE;
  } else {
    process.env.OPEN_PRIOR_AUTH_EXECUTION_MODE = mode;
  }
  try {
    await callback();
  } finally {
    if (previous === undefined) {
      delete process.env.OPEN_PRIOR_AUTH_EXECUTION_MODE;
    } else {
      process.env.OPEN_PRIOR_AUTH_EXECUTION_MODE = previous;
    }
  }
}

async function withTestServer(fixture, callback) {
  const server = createServer(fixture);

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

function assertForbidden(outcome, path) {
  assert.equal(outcome.resourceType, "OperationOutcome");
  assert.equal(outcome.issue[0].severity, "error");
  assert.equal(outcome.issue[0].code, "forbidden");
  assert.match(outcome.issue[0].diagnostics, new RegExp(escapeRegExp(path)));
  assert.match(outcome.issue[0].diagnostics, /OPEN_PRIOR_AUTH_EXECUTION_MODE=production/);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("production execution mode keeps read/discovery routes available and blocks local mutation routes", async () => {
  await withExecutionMode("production", async () => {
    const fixture = createFixture();
    await withTestServer(fixture, async (baseUrl) => {
      const health = await getJson(baseUrl, "/health");
      const discovery = await getJson(baseUrl, "/cds-services");
      const boundaries = await getJson(baseUrl, "/standards/boundaries");

      assert.equal(health.status, "ok");
      assert.equal(discovery.conformance, false);
      assert.equal(boundaries.conformance, false);

      for (const [path, body] of [
        ["/requirements/evaluate", goldenScenario.request],
        ["/work-items", { evaluationId: "eval-blocked" }],
        ["/agent-runs/prior-auth-deterministic", { workItemId: "wi-blocked" }],
        ["/demo/seed-work-items", { count: 1 }],
        ["/dtr/package", { workItemId: "wi-blocked" }],
        ["/dtr/save-response", { workItemId: "wi-blocked" }],
        ["/pas/build-packet", { workItemId: "wi-blocked" }],
        ["/pas/submit", { packetId: "packet-blocked" }],
        ["/fhir/Claim/$submit", { packetId: "packet-blocked" }],
        ["/work-items/wi-blocked/evidence/attach-fixture", { fixtureId: "fixture-blocked" }],
        ["/work-items/wi-blocked/request-more-info", { actor: "mock-payer", message: "Blocked." }],
        ["/work-items/wi-blocked/record-payer-status", { status: "pended", actor: "mock-payer" }]
      ]) {
        assertForbidden(await postJson(baseUrl, path, body, 403), path);
      }
    });
  });
});

test("local execution mode remains default for existing synthetic demo writes", async () => {
  await withExecutionMode(undefined, async () => {
    const fixture = createFixture();
    await withTestServer(fixture, async (baseUrl) => {
      const evaluation = await postJson(baseUrl, "/requirements/evaluate", goldenScenario.request);
      const workItem = await postJson(baseUrl, "/work-items", {
        evaluationId: evaluation.evaluationId,
        ownerUserId: "local-mode-test"
      }, 201);

      assert.equal(evaluation.evaluationStatus, "requirements_found");
      assert.equal(workItem.ownerUserId, "local-mode-test");
    });
  });
});
