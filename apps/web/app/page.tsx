"use client";

import { useMemo, useState } from "react";
import type {
  FhirQuestionnaireItem,
  FhirQuestionnaireResponse,
  FhirQuestionnaireResponseAnswer,
  FhirQuestionnaireResponseItem,
  SubmissionPacket,
  SubmissionReceipt,
  PrefillSummary,
  QuestionnairePackage,
  RequirementEvaluationResult,
  StatusEvent,
  ValidationIssue,
  WorkItem
} from "@open-prior-auth/shared-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

const goldenRequest = {
  patientId: "patient-mri-001",
  coverageId: "coverage-acme-001",
  requestResourceType: "ServiceRequest",
  requestResourceId: "servicerequest-mri-lumbar-001",
  serviceLine: "mri_lumbar_spine",
  payerId: "acme-health"
};

type PatientContext = {
  patient: { id?: string; name?: Array<{ given?: string[]; family?: string }> } | null;
  coverage: { id?: string; class?: Array<{ name?: string }> } | null;
  request: { id?: string; code?: { text?: string } } | null;
  conditions: Array<{ id?: string; code?: { text?: string } }>;
  observations: Array<{ id?: string; code?: { text?: string }; valueString?: string }>;
};

export default function Home() {
  const [context, setContext] = useState<PatientContext | null>(null);
  const [evaluation, setEvaluation] = useState<RequirementEvaluationResult | null>(null);
  const [workItem, setWorkItem] = useState<WorkItem | null>(null);
  const [questionnairePackage, setQuestionnairePackage] = useState<QuestionnairePackage | null>(null);
  const [formResponse, setFormResponse] = useState<FhirQuestionnaireResponse | null>(null);
  const [submissionPacket, setSubmissionPacket] = useState<SubmissionPacket | null>(null);
  const [submissionReceipt, setSubmissionReceipt] = useState<SubmissionReceipt | null>(null);
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patientName = useMemo(() => {
    const name = context?.patient?.name?.[0];
    return name ? [...(name.given ?? []), name.family].filter(Boolean).join(" ") : "Golden MRI case";
  }, [context]);

  async function launchShim() {
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/context/patient/${goldenRequest.patientId}`);
      if (!response.ok) {
        throw new Error(`Context lookup failed with ${response.status}`);
      }
      setContext(await response.json() as PatientContext);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Context lookup failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function evaluateRequirements() {
    setIsBusy(true);
    setError(null);
    setWorkItem(null);
    setQuestionnairePackage(null);
    setFormResponse(null);
    setSubmissionPacket(null);
    setSubmissionReceipt(null);
    setStatusEvents([]);
    try {
      const response = await fetch(`${API_BASE_URL}/requirements/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(goldenRequest)
      });
      if (!response.ok) {
        throw new Error(`Requirement evaluation failed with ${response.status}`);
      }
      setEvaluation(await response.json() as RequirementEvaluationResult);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Requirement evaluation failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function createWorkItem() {
    if (!evaluation) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/work-items`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          evaluationId: evaluation.evaluationId,
          ownerUserId: "m2-demo-operator"
        })
      });
      if (!response.ok) {
        throw new Error(`Work item creation failed with ${response.status}`);
      }
      const created = await response.json() as WorkItem;
      setWorkItem(created);
      await refreshStatus(created.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Work item creation failed");
    } finally {
      setIsBusy(false);
    }
  }

  async function openFormWorkspace() {
    if (!workItem) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const pkg = await postJson<QuestionnairePackage>("/dtr/package", { workItemId: workItem.id });
      setQuestionnairePackage(pkg);
      setFormResponse(clone(pkg.questionnaireResponse));
      setWorkItemStatusFromPackage(pkg, true);
      await refreshStatus(workItem.id);
    } catch (caught) {
      setError(formatCaught(caught, "Form package lookup failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function saveResponse(markReadyForReview = false) {
    if (!questionnairePackage || !formResponse) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const pkg = await postJson<QuestionnairePackage>("/dtr/save-response", {
        workItemId: questionnairePackage.workItemId,
        questionnaireResponse: formResponse,
        revision: questionnairePackage.session.revision,
        actorUserId: "m2-demo-operator",
        markReadyForReview
      });
      setQuestionnairePackage(pkg);
      setFormResponse(clone(pkg.questionnaireResponse));
      setWorkItemStatusFromPackage(pkg);
      setSubmissionPacket(null);
      setSubmissionReceipt(null);
      await refreshWorkItem(pkg.workItemId);
      await refreshStatus(pkg.workItemId);
    } catch (caught) {
      setError(formatCaught(caught, "Questionnaire save failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function buildPacket() {
    if (!workItem) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const packet = await postJson<SubmissionPacket>("/pas/build-packet", {
        workItemId: workItem.id,
        actorUserId: "m3-demo-operator"
      });
      setSubmissionPacket(packet);
      setSubmissionReceipt(null);
      await refreshWorkItem(workItem.id);
      await refreshStatus(workItem.id);
    } catch (caught) {
      setError(formatCaught(caught, "Packet build failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function submitPacket() {
    if (!submissionPacket) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const receipt = await postJson<SubmissionReceipt>("/pas/submit", {
        packetId: submissionPacket.id,
        actorUserId: "m3-demo-operator"
      });
      setSubmissionReceipt(receipt);
      await refreshWorkItem(submissionPacket.workItemId);
      await refreshStatus(submissionPacket.workItemId);
    } catch (caught) {
      setError(formatCaught(caught, "Mock PAS submission failed"));
    } finally {
      setIsBusy(false);
    }
  }

  function updateAnswer(item: FhirQuestionnaireItem, rawValue: string) {
    if (!formResponse) {
      return;
    }
    setFormResponse(updateResponseAnswer(formResponse, item, rawValue));
  }

  function resetToPrefill(item: FhirQuestionnaireItem) {
    if (!formResponse || !questionnairePackage) {
      return;
    }
    const override = questionnairePackage.session.prefillOverrides.find((candidate) => candidate.linkId === item.linkId);
    const packageItem = findResponseItem(questionnairePackage.questionnaireResponse.item, item.linkId);
    const originalAnswer = override
      ? valueToAnswer(item, override.originalValue)
      : packageItem?.answer?.[0];
    setFormResponse(updateResponseAnswerObject(formResponse, item.linkId, originalAnswer));
  }

  function setWorkItemStatusFromPackage(pkg: QuestionnairePackage, preservePacketState = false) {
    setWorkItem((current) => current
      ? {
          ...current,
          status: preservePacketState && ["packet_ready", "submitted"].includes(current.status)
            ? current.status
            : pkg.session.status === "review_ready" ? "review_ready" : "questionnaire_in_progress"
        }
      : current);
  }

  async function refreshWorkItem(workItemId: string) {
    setWorkItem(await getJson<WorkItem>(`/work-items/${workItemId}`));
  }

  async function refreshStatus(workItemId: string) {
    setStatusEvents(await getJson<StatusEvent[]>(`/work-items/${workItemId}/status`));
  }

  return (
    <main>
      <section className="topBar">
        <div>
          <p className="eyebrow">M3 PAS-style local submission demo</p>
          <h1>Open Prior Auth Workbench</h1>
        </div>
        <div className="statusPill">Synthetic data only</div>
      </section>

      <section className="workspace">
        <aside className="rail">
          <button type="button" onClick={launchShim} disabled={isBusy}>
            Launch shim
          </button>
          <button type="button" onClick={evaluateRequirements} disabled={isBusy}>
            Evaluate requirements
          </button>
          <button type="button" onClick={createWorkItem} disabled={isBusy || !evaluation}>
            Create work item
          </button>
          <button type="button" onClick={openFormWorkspace} disabled={isBusy || !workItem}>
            Open form workspace
          </button>
          <button type="button" onClick={() => saveResponse(false)} disabled={isBusy || !questionnairePackage}>
            Save draft
          </button>
          <button type="button" onClick={() => saveResponse(true)} disabled={isBusy || !questionnairePackage}>
            Mark ready
          </button>
          <button
            type="button"
            onClick={buildPacket}
            disabled={isBusy || !workItem || !["review_ready", "packet_ready"].includes(workItem.status)}
          >
            Build packet
          </button>
          <button type="button" onClick={submitPacket} disabled={isBusy || !submissionPacket}>
            Submit mock PAS
          </button>
        </aside>

        <section className="panel contextPanel">
          <div className="panelHeader">
            <p className="eyebrow">Patient and order context</p>
            <h2>{patientName}</h2>
          </div>
          <dl className="facts">
            <div>
              <dt>Coverage</dt>
              <dd>{context?.coverage?.class?.[0]?.name ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Request</dt>
              <dd>{context?.request?.code?.text ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Diagnosis</dt>
              <dd>{context?.conditions?.[0]?.code?.text ?? "Not loaded"}</dd>
            </div>
            <div>
              <dt>Evidence</dt>
              <dd>{context?.observations?.[0]?.valueString ?? "Not loaded"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel resultPanel">
          <div className="panelHeader">
            <p className="eyebrow">Requirement evaluation</p>
            <h2>{evaluation?.evaluationStatus.replaceAll("_", " ") ?? "Waiting for evaluation"}</h2>
          </div>
          {evaluation ? (
            <div className="resultGrid">
              <Metric label="Evaluation ID" value={evaluation.evaluationId} />
              <Metric label="Matched rule" value={evaluation.matchedRuleId ?? "None"} />
              <Metric label="Next action" value={evaluation.nextAction.replaceAll("_", " ")} />
              <Metric label="Missing data" value={String(evaluation.missingData.length)} />
            </div>
          ) : (
            <p className="muted">Run the deterministic M1 rule pack to see prior-auth requirements.</p>
          )}
          {evaluation?.explanatoryNotes.map((note) => (
            <p className="note" key={note}>{note}</p>
          ))}
        </section>

        <section className="panel queuePanel">
          <div className="panelHeader">
            <p className="eyebrow">Queue shell</p>
            <h2>{workItem ? workItem.id : "No active work item"}</h2>
          </div>
          {workItem ? (
            <dl className="facts compact">
              <div>
                <dt>Status</dt>
                <dd>{workItem.status.replaceAll("_", " ")}</dd>
              </div>
              <div>
                <dt>QuestionnaireResponse</dt>
                <dd>{questionnairePackage?.questionnaireResponse.status ?? "Not opened"}</dd>
              </div>
              <div>
                <dt>Session revision</dt>
                <dd>{questionnairePackage?.session.revision ?? "Not opened"}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{workItem.ownerUserId}</dd>
              </div>
            </dl>
          ) : (
            <p className="muted">Create a work item only after evaluating the golden scenario.</p>
          )}
        </section>

        <SubmissionPanel
          packet={submissionPacket}
          receipt={submissionReceipt}
          events={statusEvents}
        />

        <QuestionnaireWorkspace
          pkg={questionnairePackage}
          response={formResponse}
          onChange={updateAnswer}
          onReset={resetToPrefill}
        />
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}

function SubmissionPanel({
  packet,
  receipt,
  events
}: {
  packet: SubmissionPacket | null;
  receipt: SubmissionReceipt | null;
  events: StatusEvent[];
}) {
  const claim = packet?.bundle.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource;
  const claimResponse = receipt?.responseBundle.entry.find((entry) => entry.resource.resourceType === "ClaimResponse")?.resource;

  return (
    <section className="panel submissionPanel">
      <div className="panelHeader">
        <p className="eyebrow">PAS-style local packet</p>
        <h2>{receipt ? "Mock PAS submitted" : packet ? "Packet ready" : "No packet built"}</h2>
      </div>

      {packet ? (
        <div className="resultGrid">
          <Metric label="Packet ID" value={packet.id} />
          <Metric label="Claim use" value={String(claim?.use ?? "Not built")} />
          <Metric label="QR revision" value={String(packet.snapshot.questionnaireResponseRevision)} />
          <Metric label="Attachments" value={`${packet.attachmentManifest.attachments.length} fixtures`} />
        </div>
      ) : (
        <p className="muted">Build a packet after the questionnaire is marked ready for review.</p>
      )}

      {packet && (
        <p className="note">{packet.attachmentManifest.missingFixtureReason}</p>
      )}

      {receipt && (
        <div className="receiptBox">
          <Metric label="Tracking ID" value={receipt.trackingId} />
          <Metric label="Transport" value={receipt.transport} />
          <Metric label="ClaimResponse" value={String(claimResponse?.id ?? "Not returned")} />
          <Metric label="Idempotent" value={String(receipt.idempotent)} />
        </div>
      )}

      <div className="timeline">
        <p className="eyebrow">Status timeline</p>
        {events.length > 0 ? events.map((event) => (
          <div className="timelineEvent" key={event.eventId}>
            <strong>{event.toStatus.replaceAll("_", " ")}</strong>
            <span>{event.fromStatus ? `${event.fromStatus.replaceAll("_", " ")} -> ` : ""}{event.causedBy}</span>
            <small>{event.actor} - {event.packetId ?? event.receiptId ?? event.eventId}</small>
          </div>
        )) : (
          <p className="muted">Create a work item to start the lifecycle timeline.</p>
        )}
      </div>
    </section>
  );
}

function QuestionnaireWorkspace({
  pkg,
  response,
  onChange,
  onReset
}: {
  pkg: QuestionnairePackage | null;
  response: FhirQuestionnaireResponse | null;
  onChange: (item: FhirQuestionnaireItem, rawValue: string) => void;
  onReset: (item: FhirQuestionnaireItem) => void;
}) {
  if (!pkg || !response) {
    return (
      <section className="panel formPanel">
        <div className="panelHeader">
          <p className="eyebrow">Form workspace</p>
          <h2>No questionnaire package loaded</h2>
        </div>
        <p className="muted">Open the form workspace after creating a work item.</p>
      </section>
    );
  }

  const issueCount = pkg.validation.issues.length;

  return (
    <section className="panel formPanel">
      <div className="panelHeader formHeader">
        <div>
          <p className="eyebrow">Local DTR-like package</p>
          <h2>{pkg.questionnaire.title ?? pkg.questionnaire.id}</h2>
        </div>
        <div className="completion">
          {pkg.completion.requiredAnswered}/{pkg.completion.requiredTotal} required
          <strong>{pkg.completion.percentage}%</strong>
        </div>
      </div>

      <div className={pkg.validation.valid ? "validationSummary valid" : "validationSummary invalid"}>
        {pkg.validation.valid ? "Validation passed" : `${issueCount} validation issue${issueCount === 1 ? "" : "s"}`}
      </div>

      <div className="formGrid">
        {pkg.questionnaire.item.map((item) => (
          <QuestionnaireField
            key={item.linkId}
            item={item}
            response={response}
            prefill={pkg.prefill.find((candidate) => candidate.linkId === item.linkId)}
            issues={pkg.validation.issues.filter((issue) => issue.linkId === item.linkId)}
            edited={isFieldEdited(pkg, response, item)}
            disabled={!isEnabled(item, response)}
            onChange={onChange}
            onReset={onReset}
          />
        ))}
      </div>
    </section>
  );
}

function QuestionnaireField({
  item,
  response,
  prefill,
  issues,
  edited,
  disabled,
  onChange,
  onReset
}: {
  item: FhirQuestionnaireItem;
  response: FhirQuestionnaireResponse;
  prefill?: PrefillSummary;
  issues: ValidationIssue[];
  edited: boolean;
  disabled: boolean;
  onChange: (item: FhirQuestionnaireItem, rawValue: string) => void;
  onReset: (item: FhirQuestionnaireItem) => void;
}) {
  const responseItem = findResponseItem(response.item, item.linkId);
  const value = controlValue(responseItem?.answer?.[0]);

  return (
    <label className={disabled ? "field disabledField" : "field"}>
      <span className="fieldTopline">
        <span>{item.text ?? item.linkId}{item.required ? " *" : ""}</span>
        <span className="badges">
          {prefill && <em>Prefilled from {prefill.sourceResourceType}</em>}
          {edited && <strong>Edited</strong>}
        </span>
      </span>

      {item.type === "text" ? (
        <textarea
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(item, event.target.value)}
        />
      ) : item.type === "boolean" ? (
        <select
          value={typeof value === "boolean" ? String(value) : ""}
          disabled={disabled}
          onChange={(event) => onChange(item, event.target.value)}
        >
          <option value="">Select</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : item.type === "choice" ? (
        <select
          value={typeof value === "object" && value && "code" in value ? String(value.code) : ""}
          disabled={disabled}
          onChange={(event) => onChange(item, event.target.value)}
        >
          <option value="">Select</option>
          {item.answerOption?.map((option) => (
            <option key={option.valueCoding?.code ?? option.valueString} value={option.valueCoding?.code ?? option.valueString}>
              {option.valueCoding?.display ?? option.valueString}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(item, event.target.value)}
        />
      )}

      {prefill && (
        <button className="resetButton" type="button" onClick={() => onReset(item)}>
          Reset to prefill
        </button>
      )}
      {issues.map((issue) => (
        <span className={issue.severity === "warning" ? "fieldIssue warning" : "fieldIssue"} key={`${issue.rule}-${issue.message}`}>
          {issue.message}
        </span>
      ))}
    </label>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const payload = await response.json();

  if (!response.ok) {
    throw payload;
  }

  return payload as T;
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  const payload = await response.json();

  if (!response.ok) {
    throw payload;
  }

  return payload as T;
}

function updateResponseAnswer(
  response: FhirQuestionnaireResponse,
  item: FhirQuestionnaireItem,
  rawValue: string
): FhirQuestionnaireResponse {
  return updateResponseAnswerObject(response, item.linkId, valueToAnswer(item, rawValue));
}

function updateResponseAnswerObject(
  response: FhirQuestionnaireResponse,
  linkId: string,
  answer: FhirQuestionnaireResponseAnswer | undefined
): FhirQuestionnaireResponse {
  return {
    ...response,
    item: response.item.map((item) => updateResponseItem(item, linkId, answer))
  };
}

function updateResponseItem(
  item: FhirQuestionnaireResponseItem,
  linkId: string,
  answer: FhirQuestionnaireResponseAnswer | undefined
): FhirQuestionnaireResponseItem {
  if (item.linkId === linkId) {
    const { answer: _answer, ...rest } = item;
    return answer ? { ...rest, answer: [answer] } : rest;
  }
  return {
    ...item,
    ...(item.item ? { item: item.item.map((child) => updateResponseItem(child, linkId, answer)) } : {})
  };
}

function valueToAnswer(
  item: FhirQuestionnaireItem,
  value: unknown
): FhirQuestionnaireResponseAnswer | undefined {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }
  if (item.type === "boolean") {
    return { valueBoolean: value === true || value === "true" };
  }
  if (item.type === "choice") {
    const option = item.answerOption?.find((candidate) => candidate.valueCoding?.code === value || candidate.valueString === value);
    if (option?.valueCoding) {
      return { valueCoding: option.valueCoding };
    }
    if (option?.valueString) {
      return { valueString: option.valueString };
    }
    return undefined;
  }
  if (typeof value === "object" && value && "code" in value) {
    return { valueCoding: value as FhirQuestionnaireResponseAnswer["valueCoding"] };
  }
  return { valueString: String(value) };
}

function findResponseItem(
  items: FhirQuestionnaireResponseItem[],
  linkId: string
): FhirQuestionnaireResponseItem | undefined {
  for (const item of items) {
    if (item.linkId === linkId) {
      return item;
    }
    const child = item.item ? findResponseItem(item.item, linkId) : undefined;
    if (child) {
      return child;
    }
  }
  return undefined;
}

function controlValue(answer: FhirQuestionnaireResponseAnswer | undefined): unknown {
  if (!answer) {
    return "";
  }
  return answer.valueBoolean ?? answer.valueCoding ?? answer.valueString ?? "";
}

function isFieldEdited(
  pkg: QuestionnairePackage,
  response: FhirQuestionnaireResponse,
  item: FhirQuestionnaireItem
): boolean {
  const hasSavedOverride = pkg.session.prefillOverrides.some((override) => override.linkId === item.linkId);
  if (hasSavedOverride) {
    return true;
  }
  const original = controlValue(findResponseItem(pkg.questionnaireResponse.item, item.linkId)?.answer?.[0]);
  const current = controlValue(findResponseItem(response.item, item.linkId)?.answer?.[0]);
  return JSON.stringify(original) !== JSON.stringify(current);
}

function isEnabled(item: FhirQuestionnaireItem, response: FhirQuestionnaireResponse): boolean {
  if (!item.enableWhen?.length) {
    return true;
  }
  return item.enableWhen.every((condition) => {
    const answer = findResponseItem(response.item, condition.question)?.answer?.[0];
    const value = controlValue(answer);
    if (condition.operator === "=" && "answerBoolean" in condition) {
      return value === condition.answerBoolean;
    }
    return true;
  });
}

function formatCaught(caught: unknown, fallback: string): string {
  if (caught && typeof caught === "object" && "resourceType" in caught) {
    const outcome = caught as { issue?: Array<{ diagnostics?: string }> };
    return outcome.issue?.[0]?.diagnostics ?? fallback;
  }
  return caught instanceof Error ? caught.message : fallback;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
