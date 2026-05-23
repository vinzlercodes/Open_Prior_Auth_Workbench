import type { RequirementEvaluationRequest } from "@open-prior-auth/shared-types";
import { evaluateRequirements } from "@open-prior-auth/prior-auth-core";
import { FixtureFhirRepository } from "../fhir/fixtureRepository.js";
import { SqliteStore } from "../storage/sqliteStore.js";

const count = Math.max(1, Math.min(Number(process.argv[2] ?? 3), 10));
const ownerUserId = process.env.DEMO_OWNER_USER_ID;
const repository = new FixtureFhirRepository();
const store = new SqliteStore();

const baseRequest: RequirementEvaluationRequest = {
  patientId: "patient-mri-001",
  coverageId: "coverage-acme-001",
  requestResourceType: "ServiceRequest",
  requestResourceId: "servicerequest-mri-lumbar-001",
  serviceLine: "mri_lumbar_spine",
  payerId: "acme-health"
};
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
    ownerUserId
  });
});

store.close();
const createdSummary = created.map((item) => ({
  id: item.id,
  evaluationId: item.evaluationId,
  status: item.status
}));
console.log(JSON.stringify({ createdCount: created.length, items: createdSummary }, null, 2));
