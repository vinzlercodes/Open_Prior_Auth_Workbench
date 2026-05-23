import type { DoctorToolSchema } from "./types.js";

const stringSchema = (description: string): DoctorToolSchema => ({
  type: "string",
  description
});

const objectSchema = (
  description: string,
  properties: Record<string, DoctorToolSchema>,
  required: string[] = []
): DoctorToolSchema => ({
  type: "object",
  description,
  properties,
  required,
  additionalProperties: false
});

export const workItemIdInputSchema = objectSchema(
  "Tool input scoped to a prior authorization work item.",
  {
    workItemId: stringSchema("Prior authorization work item identifier.")
  },
  ["workItemId"]
);

export const queueListInputSchema = objectSchema(
  "Queue list filters.",
  {
    query: {
      type: "object",
      description: "Optional work item queue query.",
      properties: {
        status: stringSchema("Filter by internal or effective operations status."),
        owner: stringSchema("Filter by owner user id, or unassigned."),
        sort: {
          type: "string",
          description: "Queue sort order.",
          enum: ["age_desc", "age_asc", "updated_desc", "updated_asc"]
        }
      },
      additionalProperties: false
    }
  }
);

export const requirementsEvaluateInputSchema = objectSchema(
  "Requirement evaluation request wrapper.",
  {
    request: objectSchema(
      "Provider-side prior authorization requirement evaluation request.",
      {
        patientId: stringSchema("FHIR Patient id."),
        coverageId: stringSchema("FHIR Coverage id."),
        requestResourceType: {
          type: "string",
          description: "FHIR request resource type.",
          enum: ["ServiceRequest", "MedicationRequest", "DeviceRequest"]
        },
        requestResourceId: stringSchema("FHIR request resource id."),
        serviceLine: stringSchema("Local service line identifier."),
        payerId: stringSchema("Local payer identifier.")
      },
      ["patientId", "coverageId", "requestResourceType", "requestResourceId", "serviceLine", "payerId"]
    )
  },
  ["request"]
);

export const packetBuildInputSchema = objectSchema(
  "PAS-style local submission packet build request.",
  {
    workItemId: stringSchema("Prior authorization work item identifier."),
    actorUserId: stringSchema("Optional actor user id for audit linkage.")
  },
  ["workItemId"]
);

export const questionnaireSaveInputSchema = objectSchema(
  "Guarded questionnaire response save request.",
  {
    workItemId: stringSchema("Prior authorization work item identifier."),
    questionnaireResponse: {
      type: "object",
      description: "FHIR QuestionnaireResponse payload.",
      additionalProperties: true
    },
    revision: {
      type: "number",
      description: "Questionnaire session revision."
    },
    actorUserId: stringSchema("Optional actor user id for audit linkage."),
    markReadyForReview: {
      type: "boolean",
      description: "Whether to mark a valid response ready for review."
    }
  },
  ["workItemId", "questionnaireResponse", "revision"]
);

export const packetSubmitInputSchema = objectSchema(
  "Guarded mock PAS submit request.",
  {
    packetId: stringSchema("Submission packet identifier."),
    actorUserId: stringSchema("Optional actor user id for audit linkage.")
  },
  ["packetId"]
);

export const outputObjectSchema = (description: string): DoctorToolSchema => ({
  type: "object",
  description,
  additionalProperties: true
});

export const outputArraySchema = (description: string): DoctorToolSchema => ({
  type: "array",
  description,
  items: outputObjectSchema("Tool result item.")
});
