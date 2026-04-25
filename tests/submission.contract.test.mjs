import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { evaluateRequirement } from "../apps/api/dist/evaluation/evaluate.js";
import { OperationOutcomeError } from "../apps/api/dist/errors.js";
import { FixtureFhirRepository } from "../apps/api/dist/fhir/fixtureRepository.js";
import { QuestionnaireService } from "../apps/api/dist/questionnaires/questionnaireService.js";
import { MemoryStore } from "../apps/api/dist/storage/memoryStore.js";
import { SubmissionService } from "../apps/api/dist/submissions/submissionService.js";

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
    ownerUserId: "m3-test-operator"
  });
  const questionnaireService = new QuestionnaireService(repository, store);
  const submissionService = new SubmissionService(repository, store);

  return { questionnaireService, store, submissionService, workItem };
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

function markReady(questionnaireService, workItem) {
  const pkg = questionnaireService.getPackage(workItem.id);
  return questionnaireService.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: completeResponse(clone(pkg.questionnaireResponse)),
    revision: pkg.session.revision,
    actorUserId: "m3-test-operator",
    markReadyForReview: true
  });
}

function assertOutcome(error, statusCode, code) {
  assert.ok(error instanceof OperationOutcomeError);
  assert.equal(error.statusCode, statusCode);
  assert.equal(error.outcome.resourceType, "OperationOutcome");
  assert.equal(error.outcome.issue[0].code, code);
}

function findResource(bundle, resourceType) {
  return bundle.entry.find((entry) => entry.resource.resourceType === resourceType)?.resource;
}

test("building a PAS-style local packet requires a review-ready work item", () => {
  const { submissionService, workItem } = createFixture();

  assert.throws(
    () => submissionService.buildPacket({
      workItemId: workItem.id,
      actorUserId: "m3-test-operator"
    }),
    (error) => {
      assertOutcome(error, 409, "conflict");
      return true;
    }
  );
});

test("golden case builds a deterministic PAS-style local packet with a preauthorization Claim", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  const ready = markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const rebuilt = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const claim = findResource(packet.bundle, "Claim");

  assert.equal(packet.id, rebuilt.id);
  assert.equal(packet.transport, "mock-pas");
  assert.equal(packet.packetSchemaVersion, "m3.local-pas-style.v1");
  assert.equal(packet.snapshot.workItemId, workItem.id);
  assert.equal(packet.snapshot.questionnaireResponseId, ready.questionnaireResponse.id);
  assert.equal(packet.snapshot.questionnaireResponseRevision, ready.session.revision);
  assert.equal(packet.snapshot.payerId, workItem.payerId);
  assert.equal(packet.attachmentManifest.attachments.length, 0);
  assert.equal(packet.attachmentManifest.missingFixtureReason, "No document fixtures in M3");
  assert.equal(claim.use, "preauthorization");
  assert.equal(findResource(packet.bundle, "QuestionnaireResponse").id, ready.questionnaireResponse.id);
  assert.equal(store.getWorkItem(workItem.id).status, "packet_ready");
});

test("mock PAS submission returns a ClaimResponse-like response Bundle and is idempotent", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const receipt = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const again = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const claimResponse = findResource(receipt.responseBundle, "ClaimResponse");

  assert.equal(receipt.packetId, packet.id);
  assert.equal(receipt.transport, "mock-pas");
  assert.equal(receipt.idempotent, false);
  assert.equal(claimResponse.use, "preauthorization");
  assert.equal(claimResponse.preAuthRef, receipt.trackingId);
  assert.equal(receipt.responseBundle.entry.length, 1);
  assert.equal(again.receiptId, receipt.receiptId);
  assert.equal(again.idempotent, true);
  assert.equal(store.getWorkItem(workItem.id).status, "submitted");
});

test("status timeline records review-ready to packet-ready to submitted transitions", () => {
  const { questionnaireService, store, submissionService, workItem } = createFixture();
  markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const receipt = submissionService.submitPacket({
    packetId: packet.id,
    actorUserId: "m3-test-operator"
  });
  const events = store.getStatusEvents(workItem.id);
  const transitions = events.map((event) => `${event.fromStatus ?? "none"}->${event.toStatus}`);
  const packetReady = events.find((event) => event.toStatus === "packet_ready");
  const submitted = events.find((event) => event.toStatus === "submitted");

  assert.ok(transitions.includes("review_ready->packet_ready"));
  assert.ok(transitions.includes("packet_ready->submitted"));
  assert.ok(packetReady.eventId);
  assert.equal(packetReady.workItemId, workItem.id);
  assert.equal(packetReady.actor, "m3-test-operator");
  assert.equal(packetReady.packetId, packet.id);
  assert.equal(packetReady.causedBy, "submission_packet.built");
  assert.ok(packetReady.at);
  assert.equal(submitted.receiptId, receipt.receiptId);
  assert.equal(submitted.packetId, packet.id);
});

test("submit rejects a stale packet after the QuestionnaireResponse revision changes", () => {
  const { questionnaireService, submissionService, workItem } = createFixture();
  const ready = markReady(questionnaireService, workItem);
  const packet = submissionService.buildPacket({
    workItemId: workItem.id,
    actorUserId: "m3-test-operator"
  });
  const editedResponse = clone(ready.questionnaireResponse);
  setAnswer(editedResponse, "clinical-urgency", {
    valueCoding: {
      system: "http://openpriorauth.local/fhir/CodeSystem/clinical-urgency",
      code: "urgent",
      display: "Urgent"
    }
  });
  questionnaireService.saveResponse({
    workItemId: workItem.id,
    questionnaireResponse: editedResponse,
    revision: ready.session.revision,
    actorUserId: "m3-test-operator",
    markReadyForReview: true
  });

  assert.throws(
    () => submissionService.submitPacket({
      packetId: packet.id,
      actorUserId: "m3-test-operator"
    }),
    (error) => {
      assertOutcome(error, 409, "conflict");
      assert.match(error.message, /stale/);
      return true;
    }
  );
});
