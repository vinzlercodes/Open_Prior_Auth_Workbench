import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateRequirement } from "../packages/prior-auth-core/dist/index.js";
import { createServer } from "../apps/api/dist/server.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";

const goldenScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/mri-lumbar-spine.json"), "utf8")
);
const dmeScenario = JSON.parse(
  readFileSync(resolve(process.cwd(), "data/fixtures/golden-scenarios/dme-power-wheelchair.json"), "utf8")
);

function createFixture(scenario) {
  const repository = new FixtureFhirRepository(scenario.bundlePath);
  const store = new MemoryStore();
  const result = store.saveEvaluation(
    scenario.request,
    evaluateRequirement(scenario.request, repository)
  );
  const workItem = store.createWorkItem({
    evaluationId: result.evaluationId,
    ownerUserId: "m5-test-operator"
  });
  return { repository, store, workItem };
}

async function withTestServer(fixture, callback) {
  const server = createServer({
    repository: fixture.repository,
    store: fixture.store,
    runtimeStorePath: fixture.runtimeStorePath ?? ":memory:"
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

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const json = await response.json();
  assert.equal(response.status, 200, JSON.stringify(json));
  return json;
}

for (const [label, scenario] of [
  ["MRI", goldenScenario],
  ["DME", dmeScenario]
]) {
  test(`M5 cockpit agent run returns case-first ${label} timeline and pauses before submit`, async () => {
    const fixture = createFixture(scenario);

    await withTestServer(fixture, async (baseUrl) => {
      const body = await postJson(baseUrl, "/agent-runs/prior-auth-deterministic", {
        workItemId: fixture.workItem.id,
        actorUserId: "m5-test-operator"
      });

      assert.equal(body.workItem.id, fixture.workItem.id);
      assert.equal(body.workItem.serviceLine, scenario.request.serviceLine);
      assert.equal(body.run.status, "waiting_for_human");
      assert.equal(body.submitApproval.status, "pending");
      assert.equal(body.questionnaireApproval.status, "approved");
      assert.equal(body.packet.workItemId, fixture.workItem.id);
      assert.equal(body.receipt, null);
      assert.equal(fixture.store.getLatestSubmissionReceiptForWorkItem(fixture.workItem.id), null);
      assert.ok(body.questionnairePackage.completion.percentage > 0);
      assert.ok(Array.isArray(body.evidenceBoard));
      assert.ok(body.evidenceBoard.some((row) => row.requirementCode === "diagnosis-context"));
      assert.ok(body.evidenceBoard.some((row) => row.requirementCode !== "diagnosis-context"));
      assert.deepEqual(body.steps.map((step) => step.agent), [
        "requirement",
        "documentation",
        "evidence",
        "packet",
        "compliance"
      ]);
      assert.deepEqual(
        body.trace.map((event) => event.sequence),
        [...body.trace].map((event) => event.sequence).sort((a, b) => a - b)
      );
      assert.ok(body.trace.some((event) => event.type === "agent.started"));
      assert.ok(body.trace.some((event) => event.type === "approval.requested"));
      assert.ok(body.statusTimeline.some((event) => event.toStatus === "packet_ready"));
      assert.ok(body.auditTrace.some((event) => event.action === "submission_packet.saved"));
    });
  });
}
