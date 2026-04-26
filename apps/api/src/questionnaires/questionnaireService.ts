import { readdirSync, readFileSync } from "node:fs";
import {
  type FhirCoding,
  type FhirQuestionnaire,
  type FhirQuestionnaireAnswerOption,
  type FhirQuestionnaireEnableWhen,
  type FhirQuestionnaireItem,
  type FhirQuestionnaireResponse,
  type FhirQuestionnaireResponseAnswer,
  type FhirQuestionnaireResponseItem,
  type PrefillOverride,
  type PrefillSummary,
  type QuestionnaireCompletion,
  type QuestionnairePackage,
  type QuestionnaireResponseSaveRequest,
  type QuestionnaireSession,
  type QuestionnaireValidationResult,
  type ValidationIssue,
  type WorkItem
} from "@open-prior-auth/shared-types";
import { resolveFromRepoRoot } from "../config/paths.js";
import { evaluationHash } from "../evaluation/hash.js";
import { type FhirResource, type FixtureFhirRepository } from "../fhir/fixtureRepository.js";
import { OperationOutcomeError } from "../errors.js";
import { type PriorAuthStore } from "../storage/priorAuthStore.js";

const WORK_ITEM_EXTENSION_URL = "http://openpriorauth.local/fhir/StructureDefinition/work-item-id";

export class QuestionnaireService {
  constructor(
    private readonly repository: FixtureFhirRepository,
    private readonly store: PriorAuthStore
  ) {}

  getPackage(workItemId: string): QuestionnairePackage {
    return this.store.transaction(() => {
      const workItem = this.requireWorkItem(workItemId);
      const { questionnaire, canonical, version } = this.loadQuestionnaireForWorkItem(workItem);
      let session = this.store.getQuestionnaireSession(sessionId(workItem.id, questionnaire));

      if (!session) {
        session = this.createSession(workItem, questionnaire, canonical, version);
        this.store.saveQuestionnaireSession(session);
      }

      if (![
        "review_ready",
        "packet_ready",
        "submitted",
        "more_info_needed",
        "approved",
        "denied",
        "cancelled"
      ].includes(workItem.status)) {
        this.store.updateWorkItemStatus(workItem.id, "questionnaire_in_progress");
      }

      return this.toPackage(workItem, questionnaire, session);
    });
  }

  saveResponse(input: QuestionnaireResponseSaveRequest): QuestionnairePackage {
    return this.store.transaction(() => {
      if (typeof input.revision !== "number") {
        throw new OperationOutcomeError(400, "required", "revision is required for /dtr/save-response.");
      }

      const workItem = this.requireWorkItem(input.workItemId);
      if (["approved", "denied", "cancelled"].includes(workItem.status)) {
        throw new OperationOutcomeError(
          409,
          "conflict",
          `Work item ${workItem.id} is terminal and cannot accept questionnaire edits. Current status: ${workItem.status}.`
        );
      }

      const { questionnaire } = this.loadQuestionnaireForWorkItem(workItem);
      const currentSession = this.store.getQuestionnaireSession(sessionId(workItem.id, questionnaire));

      if (!currentSession) {
        throw new OperationOutcomeError(404, "not-found", `Questionnaire session not found for work item: ${workItem.id}`);
      }

      if (input.revision !== currentSession.revision) {
        throw new OperationOutcomeError(
          409,
          "conflict",
          `Stale questionnaire session revision for ${currentSession.id}: expected ${currentSession.revision}, received ${input.revision}.`
        );
      }

      const requestedResponse = normalizeResponseContext(input.questionnaireResponse, workItem);
      const draftResponse: FhirQuestionnaireResponse = {
        ...requestedResponse,
        status: "in-progress"
      };
      const draftValidation = validateResponse(questionnaire, draftResponse);
      const ready = Boolean(input.markReadyForReview && draftValidation.valid);
      const response = ready
        ? {
            ...draftResponse,
            status: "completed" as const
          }
        : draftResponse;
      const validation = validateResponse(questionnaire, response);
      const now = this.store.nowIso();
      const updatedSession: QuestionnaireSession = {
        ...currentSession,
        questionnaireResponse: response,
        validation,
        status: ready ? "review_ready" : "draft",
        prefillOverrides: collectPrefillOverrides(
          questionnaire,
          currentSession.questionnaireResponse,
          response,
          input.actorUserId,
          now
        ),
        updatedAt: now,
        revision: currentSession.revision + 1
      };

      this.store.saveQuestionnaireSession(updatedSession, input.actorUserId);
      const nextStatus = nextWorkItemStatusAfterQuestionnaireSave(workItem.status, ready);
      if (workItem.status !== nextStatus) {
        this.store.updateWorkItemStatus(
          workItem.id,
          nextStatus,
          input.actorUserId
        );
      }
      if (ready && workItem.status === "more_info_needed") {
        const resolved = this.store.resolveOpenMoreInfoRequest(workItem.id, "user");
        this.store.recordOperationEvent(workItem.id, "more_info_resolved", "user", {
          sessionId: updatedSession.id,
          revision: updatedSession.revision,
          moreInfoRequestId: resolved?.id
        });
      }

      return this.toPackage(
        this.requireWorkItem(workItem.id),
        questionnaire,
        updatedSession
      );
    });
  }

  private requireWorkItem(workItemId: string): WorkItem {
    const workItem = this.store.getWorkItem(workItemId);
    if (!workItem) {
      throw new OperationOutcomeError(404, "not-found", `Work item not found: ${workItemId}`);
    }
    return workItem;
  }

  private loadQuestionnaireForWorkItem(workItem: WorkItem): {
    questionnaire: FhirQuestionnaire;
    canonical: string;
    version: string;
  } {
    const canonical = workItem.requirementResult.questionnaireCanonicals[0];
    if (!canonical) {
      throw new OperationOutcomeError(404, "not-found", `No questionnaire canonical is available for work item: ${workItem.id}`);
    }

    const [url, version] = canonical.split("|");
    if (!url || !version) {
      throw new OperationOutcomeError(400, "invalid", `Questionnaire canonical must include url and version: ${canonical}`);
    }

    return {
      questionnaire: loadQuestionnaire(url, version),
      canonical,
      version
    };
  }

  private createSession(
    workItem: WorkItem,
    questionnaire: FhirQuestionnaire,
    canonical: string,
    version: string
  ): QuestionnaireSession {
    const context = this.repository.getPatientContext(
      workItem.patientId,
      workItem.coverageId,
      workItem.requestResourceType,
      workItem.requestResourceId
    );
    const prefilledResponse = buildPrefilledResponse(workItem, questionnaire, context);
    const validation = validateResponse(questionnaire, prefilledResponse);
    const now = this.store.nowIso();

    return {
      id: sessionId(workItem.id, questionnaire),
      workItemId: workItem.id,
      questionnaireCanonical: canonical,
      questionnaireVersion: version,
      questionnaireResponse: prefilledResponse,
      validation,
      status: "draft",
      prefillOverrides: [],
      createdAt: now,
      updatedAt: now,
      revision: 1
    };
  }

  private toPackage(
    workItem: WorkItem,
    questionnaire: FhirQuestionnaire,
    session: QuestionnaireSession
  ): QuestionnairePackage {
    const context = this.repository.getPatientContext(
      workItem.patientId,
      workItem.coverageId,
      workItem.requestResourceType,
      workItem.requestResourceId
    );

    return {
      workItemId: workItem.id,
      sessionId: session.id,
      questionnaireCanonical: session.questionnaireCanonical,
      questionnaireVersion: session.questionnaireVersion,
      questionnaire,
      questionnaireResponse: session.questionnaireResponse,
      dependencies: {
        libraries: [],
        valueSets: []
      },
      prefill: buildPrefillSummary(context),
      validation: session.validation,
      completion: calculateCompletion(questionnaire, session.questionnaireResponse),
      session: {
        status: session.status,
        revision: session.revision,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        prefillOverrides: session.prefillOverrides
      }
    };
  }
}

function loadQuestionnaire(url: string, version: string): FhirQuestionnaire {
  const directory = resolveFromRepoRoot("data/questionnaires");
  const files = readdirSync(directory).filter((file) => file.endsWith(".json"));

  for (const file of files) {
    const questionnaire = JSON.parse(readFileSync(`${directory}/${file}`, "utf8")) as FhirQuestionnaire;
    if (questionnaire.resourceType === "Questionnaire" && questionnaire.url === url && questionnaire.version === version) {
      assertUniqueLinkIds(questionnaire);
      return questionnaire;
    }
  }

  throw new OperationOutcomeError(404, "not-found", `Questionnaire fixture not found: ${url}|${version}`);
}

function assertUniqueLinkIds(questionnaire: FhirQuestionnaire): void {
  const seen = new Set<string>();
  for (const item of flattenItems(questionnaire.item)) {
    if (seen.has(item.linkId)) {
      throw new OperationOutcomeError(400, "invalid", `Questionnaire contains duplicate linkId: ${item.linkId}`);
    }
    seen.add(item.linkId);
  }
}

function sessionId(workItemId: string, questionnaire: FhirQuestionnaire): string {
  return `qs-${evaluationHash(`${workItemId}|${questionnaire.url}|${questionnaire.version}`)}`;
}

function nextWorkItemStatusAfterQuestionnaireSave(
  currentStatus: WorkItem["status"],
  ready: boolean
): WorkItem["status"] {
  if (ready) {
    if (currentStatus === "packet_ready" || currentStatus === "submitted") {
      return currentStatus;
    }
    return "review_ready";
  }

  if (currentStatus === "more_info_needed" || currentStatus === "packet_ready" || currentStatus === "submitted") {
    return currentStatus;
  }
  return "questionnaire_in_progress";
}

function buildPrefilledResponse(
  workItem: WorkItem,
  questionnaire: FhirQuestionnaire,
  context: ReturnType<FixtureFhirRepository["getPatientContext"]>
): FhirQuestionnaireResponse {
  const answers = new Map<string, FhirQuestionnaireResponseAnswer>();
  const patientName = formatHumanName(context.patient);
  const payerName = formatCoveragePayer(context.coverage);
  const service = formatCodeText(context.request);
  const diagnosis = context.conditions.map(formatCodeText).filter(Boolean).join("; ");
  const treatment = context.observations.map(formatObservation).filter(Boolean).join("; ");

  if (patientName) {
    answers.set("patient-name", { valueString: patientName });
  }
  if (payerName) {
    answers.set("payer-name", { valueString: payerName });
  }
  if (service) {
    answers.set("requested-service", { valueString: service });
  }
  if (diagnosis) {
    answers.set("diagnosis-summary", { valueString: diagnosis });
  }
  if (treatment) {
    answers.set("conservative-treatment-evidence", { valueString: treatment });
  }

  return {
    resourceType: "QuestionnaireResponse",
    id: `qr-${evaluationHash(`${workItem.id}|${questionnaire.url}|${questionnaire.version}`)}`,
    questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    status: "in-progress",
    subject: {
      reference: `Patient/${workItem.patientId}`
    },
    basedOn: [
      {
        reference: `${workItem.requestResourceType}/${workItem.requestResourceId}`
      }
    ],
    authored: new Date().toISOString(),
    extension: [
      {
        url: WORK_ITEM_EXTENSION_URL,
        valueString: workItem.id
      }
    ],
    item: questionnaire.item.map((item) => responseItemFromQuestionnaireItem(item, answers))
  };
}

function responseItemFromQuestionnaireItem(
  item: FhirQuestionnaireItem,
  answers: Map<string, FhirQuestionnaireResponseAnswer>
): FhirQuestionnaireResponseItem {
  const answer = answers.get(item.linkId);
  return {
    linkId: item.linkId,
    text: item.text,
    ...(answer ? { answer: [answer] } : {}),
    ...(item.item ? { item: item.item.map((child) => responseItemFromQuestionnaireItem(child, answers)) } : {})
  };
}

function buildPrefillSummary(context: ReturnType<FixtureFhirRepository["getPatientContext"]>): PrefillSummary[] {
  return [
    context.patient && {
      linkId: "patient-name",
      sourceResourceType: "Patient" as const,
      sourceResourceId: context.patient.id ?? "unknown",
      sourceLabel: "Patient name",
      valueType: "valueString",
      confidence: "deterministic" as const,
      editable: true as const
    },
    context.coverage && {
      linkId: "payer-name",
      sourceResourceType: "Coverage" as const,
      sourceResourceId: context.coverage.id ?? "unknown",
      sourceLabel: "Coverage payor",
      valueType: "valueString",
      confidence: "deterministic" as const,
      editable: true as const
    },
    context.request && {
      linkId: "requested-service",
      sourceResourceType: "ServiceRequest" as const,
      sourceResourceId: context.request.id ?? "unknown",
      sourceLabel: "Requested service",
      valueType: "valueString",
      confidence: "deterministic" as const,
      editable: true as const
    },
    context.conditions[0] && {
      linkId: "diagnosis-summary",
      sourceResourceType: "Condition" as const,
      sourceResourceId: context.conditions[0].id ?? "unknown",
      sourceLabel: "Diagnosis context",
      valueType: "valueString",
      confidence: "deterministic" as const,
      editable: true as const
    },
    context.observations[0] && {
      linkId: "conservative-treatment-evidence",
      sourceResourceType: "Observation" as const,
      sourceResourceId: context.observations[0].id ?? "unknown",
      sourceLabel: "Conservative treatment evidence",
      valueType: "valueString",
      confidence: "deterministic" as const,
      editable: true as const
    }
  ].filter((item): item is PrefillSummary => Boolean(item));
}

export function validateResponse(
  questionnaire: FhirQuestionnaire,
  response: FhirQuestionnaireResponse
): QuestionnaireValidationResult {
  const issues: ValidationIssue[] = [];
  const responseByLinkId = responseItemMap(response.item);
  const items = flattenItems(questionnaire.item).filter((item) => item.type !== "group" && item.type !== "display");

  for (const item of items) {
    const responseItem = responseByLinkId.get(item.linkId);
    const answer = responseItem?.answer?.[0];
    const enabled = isItemEnabled(item, responseByLinkId);

    if (!enabled && hasAnswer(responseItem)) {
      issues.push({
        severity: "warning",
        linkId: item.linkId,
        message: "Answer is present for an item disabled by enableWhen.",
        rule: "enable-when"
      });
    }

    if (enabled && item.required && !hasAnswer(responseItem)) {
      issues.push({
        severity: "error",
        linkId: item.linkId,
        message: "Required answer is missing.",
        rule: "required"
      });
      continue;
    }

    if (!answer) {
      continue;
    }

    const typeIssue = validateAnswerType(item, answer);
    if (typeIssue) {
      issues.push(typeIssue);
    }

    const optionIssue = validateAnswerOption(item, answer);
    if (optionIssue) {
      issues.push(optionIssue);
    }
  }

  return {
    valid: !issues.some((issue) => issue.severity === "error"),
    issues
  };
}

function calculateCompletion(
  questionnaire: FhirQuestionnaire,
  response: FhirQuestionnaireResponse
): QuestionnaireCompletion {
  const responseByLinkId = responseItemMap(response.item);
  const requiredItems = flattenItems(questionnaire.item)
    .filter((item) => item.type !== "group" && item.type !== "display" && item.required && isItemEnabled(item, responseByLinkId));
  const requiredAnswered = requiredItems.filter((item) => hasAnswer(responseByLinkId.get(item.linkId))).length;

  return {
    requiredAnswered,
    requiredTotal: requiredItems.length,
    percentage: requiredItems.length === 0 ? 100 : Math.round((requiredAnswered / requiredItems.length) * 100)
  };
}

function normalizeResponseContext(
  response: FhirQuestionnaireResponse,
  workItem: WorkItem
): FhirQuestionnaireResponse {
  const extensions = response.extension?.filter((extension) => extension.url !== WORK_ITEM_EXTENSION_URL) ?? [];
  return {
    ...response,
    subject: {
      reference: `Patient/${workItem.patientId}`
    },
    basedOn: [
      {
        reference: `${workItem.requestResourceType}/${workItem.requestResourceId}`
      }
    ],
    extension: [
      ...extensions,
      {
        url: WORK_ITEM_EXTENSION_URL,
        valueString: workItem.id
      }
    ]
  };
}

function collectPrefillOverrides(
  questionnaire: FhirQuestionnaire,
  original: FhirQuestionnaireResponse,
  current: FhirQuestionnaireResponse,
  actorUserId: string | undefined,
  editedAt: string
): PrefillOverride[] {
  const originalItems = responseItemMap(original.item);
  const currentItems = responseItemMap(current.item);
  const prefilledLinkIds = new Set(["patient-name", "payer-name", "requested-service", "diagnosis-summary", "conservative-treatment-evidence"]);
  const overrides: PrefillOverride[] = [];

  for (const item of flattenItems(questionnaire.item)) {
    if (!prefilledLinkIds.has(item.linkId)) {
      continue;
    }

    const originalValue = answerValue(originalItems.get(item.linkId)?.answer?.[0]);
    const currentValue = answerValue(currentItems.get(item.linkId)?.answer?.[0]);
    if (JSON.stringify(originalValue) !== JSON.stringify(currentValue)) {
      overrides.push({
        linkId: item.linkId,
        originalValue,
        currentValue,
        editedAt,
        ...(actorUserId ? { actorUserId } : {})
      });
    }
  }

  return overrides;
}

function flattenItems(items: FhirQuestionnaireItem[]): FhirQuestionnaireItem[] {
  return items.flatMap((item) => [item, ...(item.item ? flattenItems(item.item) : [])]);
}

function responseItemMap(items: FhirQuestionnaireResponseItem[] = []): Map<string, FhirQuestionnaireResponseItem> {
  const entries = items.flatMap((item): FhirQuestionnaireResponseItem[] => [
    item,
    ...(item.item ? [...responseItemMap(item.item).values()] : [])
  ]);
  return new Map(entries.map((item) => [item.linkId, item]));
}

function hasAnswer(item: FhirQuestionnaireResponseItem | undefined): boolean {
  const answer = item?.answer?.[0];
  if (!answer) {
    return false;
  }
  return answerValue(answer) !== undefined && answerValue(answer) !== "";
}

function answerValue(answer: FhirQuestionnaireResponseAnswer | undefined): unknown {
  if (!answer) {
    return undefined;
  }
  if ("valueBoolean" in answer) {
    return answer.valueBoolean;
  }
  if ("valueInteger" in answer) {
    return answer.valueInteger;
  }
  if ("valueDecimal" in answer) {
    return answer.valueDecimal;
  }
  if ("valueCoding" in answer) {
    return answer.valueCoding;
  }
  if ("valueDate" in answer) {
    return answer.valueDate;
  }
  if ("valueDateTime" in answer) {
    return answer.valueDateTime;
  }
  if ("valueTime" in answer) {
    return answer.valueTime;
  }
  if ("valueUri" in answer) {
    return answer.valueUri;
  }
  return answer.valueString;
}

function validateAnswerType(
  item: FhirQuestionnaireItem,
  answer: FhirQuestionnaireResponseAnswer
): ValidationIssue | null {
  const expectedByType: Partial<Record<FhirQuestionnaireItem["type"], keyof FhirQuestionnaireResponseAnswer>> = {
    boolean: "valueBoolean",
    decimal: "valueDecimal",
    integer: "valueInteger",
    date: "valueDate",
    dateTime: "valueDateTime",
    time: "valueTime",
    string: "valueString",
    text: "valueString",
    url: "valueUri",
    choice: "valueCoding",
    "open-choice": "valueString"
  };
  const expected = expectedByType[item.type];

  if (!expected) {
    return {
      severity: "warning",
      linkId: item.linkId,
      message: `Validation for Questionnaire item type ${item.type} is not supported in M2.`,
      rule: "unsupported"
    };
  }

  return expected in answer
    ? null
    : {
        severity: "error",
        linkId: item.linkId,
        message: `Answer for ${item.linkId} must use ${expected}.`,
        rule: "type"
      };
}

function validateAnswerOption(
  item: FhirQuestionnaireItem,
  answer: FhirQuestionnaireResponseAnswer
): ValidationIssue | null {
  if (!item.answerOption?.length) {
    return null;
  }

  return item.answerOption.some((option) => answerMatchesOption(answer, option))
    ? null
    : {
        severity: "error",
        linkId: item.linkId,
        message: `Answer for ${item.linkId} is not in the questionnaire answerOption set.`,
        rule: "answer-option"
      };
}

function answerMatchesOption(
  answer: FhirQuestionnaireResponseAnswer,
  option: FhirQuestionnaireAnswerOption
): boolean {
  if (option.valueString !== undefined) {
    return answer.valueString === option.valueString;
  }
  if (option.valueInteger !== undefined) {
    return answer.valueInteger === option.valueInteger;
  }
  if (option.valueBoolean !== undefined) {
    return answer.valueBoolean === option.valueBoolean;
  }
  if (option.valueCoding) {
    return codingEquals(answer.valueCoding, option.valueCoding);
  }
  return false;
}

function isItemEnabled(
  item: FhirQuestionnaireItem,
  responseByLinkId: Map<string, FhirQuestionnaireResponseItem>
): boolean {
  if (!item.enableWhen?.length) {
    return true;
  }
  return item.enableWhen.every((condition) => enableWhenMatches(condition, responseByLinkId.get(condition.question)?.answer?.[0]));
}

function enableWhenMatches(
  condition: FhirQuestionnaireEnableWhen,
  answer: FhirQuestionnaireResponseAnswer | undefined
): boolean {
  const expected = expectedEnableWhenValue(condition);
  const actual = answerValue(answer);

  if (condition.operator === "exists") {
    return Boolean(actual !== undefined) === Boolean(expected);
  }
  if (condition.operator === "=") {
    if (isCoding(expected)) {
      return codingEquals(actual as FhirCoding | undefined, expected);
    }
    return actual === expected;
  }
  if (condition.operator === "!=") {
    if (isCoding(expected)) {
      return !codingEquals(actual as FhirCoding | undefined, expected);
    }
    return actual !== expected;
  }
  return false;
}

function expectedEnableWhenValue(condition: FhirQuestionnaireEnableWhen): unknown {
  if ("answerBoolean" in condition) {
    return condition.answerBoolean;
  }
  if ("answerString" in condition) {
    return condition.answerString;
  }
  if ("answerInteger" in condition) {
    return condition.answerInteger;
  }
  return condition.answerCoding;
}

function isCoding(value: unknown): value is FhirCoding {
  return Boolean(value && typeof value === "object" && "code" in value);
}

function codingEquals(left: FhirCoding | undefined, right: FhirCoding): boolean {
  return Boolean(left && left.system === right.system && left.code === right.code);
}

function formatHumanName(resource: FhirResource | null): string | null {
  const names = resource?.name as Array<{ prefix?: string[]; given?: string[]; family?: string }> | undefined;
  const name = names?.[0];
  if (!name) {
    return null;
  }
  return [...(name.prefix ?? []), ...(name.given ?? []), name.family].filter(Boolean).join(" ");
}

function formatCodeText(resource: FhirResource | null): string | null {
  const code = resource?.code as { text?: string; coding?: Array<{ display?: string; code?: string }> } | undefined;
  return code?.text ?? code?.coding?.[0]?.display ?? code?.coding?.[0]?.code ?? null;
}

function formatCoveragePayer(resource: FhirResource | null): string | null {
  const payor = resource?.payor as Array<{ display?: string }> | undefined;
  return payor?.[0]?.display ?? null;
}

function formatObservation(resource: FhirResource): string | null {
  const code = formatCodeText(resource);
  const valueString = resource.valueString as string | undefined;
  if (!code && !valueString) {
    return null;
  }
  return [code, valueString].filter(Boolean).join(": ");
}
