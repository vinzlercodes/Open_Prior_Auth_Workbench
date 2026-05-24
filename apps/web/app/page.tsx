"use client";

import { useMemo, useState } from "react";
import type {
  AuditEvent,
  EvidenceAttachment,
  EvidenceListResponse,
  FhirQuestionnaireItem,
  FhirQuestionnaireResponse,
  FhirQuestionnaireResponseAnswer,
  FhirQuestionnaireResponseItem,
  OperationsMetrics,
  PayerUpdateStatus,
  SubmissionPacket,
  SubmissionReceipt,
  PrefillSummary,
  QuestionnairePackage,
  RequirementEvaluationResult,
  StatusEvent,
  ValidationIssue,
  WorkItem,
  WorkItemOperationsHistory,
  WorkItemQueueRow
} from "@open-prior-auth/shared-types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:4000";

const scenarioOptions = [
  {
    scenarioId: "mri-lumbar-spine-golden",
    publicName: "MRI Lumbar Spine Authorization",
    request: {
      patientId: "patient-mri-001",
      coverageId: "coverage-acme-001",
      requestResourceType: "ServiceRequest",
      requestResourceId: "servicerequest-mri-lumbar-001",
      serviceLine: "mri_lumbar_spine",
      payerId: "acme-health"
    }
  },
  {
    scenarioId: "dme-power-wheelchair",
    publicName: "DME Wheelchair Authorization",
    request: {
      patientId: "patient-dme-001",
      coverageId: "coverage-blue-ridge-001",
      requestResourceType: "DeviceRequest",
      requestResourceId: "devicerequest-power-wheelchair-001",
      serviceLine: "dme_power_wheelchair",
      payerId: "blue-ridge-health"
    }
  }
] as const;

const goldenRequest = scenarioOptions[0].request;

const moreInfoByServiceLine: Record<string, { message: string; code: string; label: string }> = {
  mri_lumbar_spine: {
    message: "Please provide conservative therapy details.",
    code: "conservative-therapy-duration",
    label: "Duration of conservative therapy"
  },
  dme_power_wheelchair: {
    message: "Please provide home mobility assessment details.",
    code: "home-mobility-assessment",
    label: "Home mobility assessment"
  }
};

type ScenarioRequest = typeof goldenRequest;

const fallbackRequest: ScenarioRequest = {
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
  request: { id?: string; code?: { text?: string }; codeCodeableConcept?: { text?: string } } | null;
  conditions: Array<{ id?: string; code?: { text?: string } }>;
  observations: Array<{ id?: string; code?: { text?: string }; valueString?: string }>;
};

export default function Home() {
  const [scenarioId, setScenarioId] = useState(scenarioOptions[0].scenarioId);
  const [context, setContext] = useState<PatientContext | null>(null);
  const [evaluation, setEvaluation] = useState<RequirementEvaluationResult | null>(null);
  const [workItem, setWorkItem] = useState<WorkItem | null>(null);
  const [questionnairePackage, setQuestionnairePackage] = useState<QuestionnairePackage | null>(null);
  const [formResponse, setFormResponse] = useState<FhirQuestionnaireResponse | null>(null);
  const [submissionPacket, setSubmissionPacket] = useState<SubmissionPacket | null>(null);
  const [submissionReceipt, setSubmissionReceipt] = useState<SubmissionReceipt | null>(null);
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [queueRows, setQueueRows] = useState<WorkItemQueueRow[]>([]);
  const [metrics, setMetrics] = useState<OperationsMetrics | null>(null);
  const [operationsHistory, setOperationsHistory] = useState<WorkItemOperationsHistory | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceListResponse | null>(null);
  const [uploadFilename, setUploadFilename] = useState("local_evidence_note.txt");
  const [uploadContent, setUploadContent] = useState("Synthetic uploaded evidence note for the local M7 demo.");
  const [queueStatusFilter, setQueueStatusFilter] = useState("");
  const [queueOwnerFilter, setQueueOwnerFilter] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scenario = scenarioOptions.find((candidate) => candidate.scenarioId === scenarioId) ?? scenarioOptions[0];
  const selectedRequest = scenario.request ?? fallbackRequest;

  const patientName = useMemo(() => {
    const name = context?.patient?.name?.[0];
    return name ? [...(name.given ?? []), name.family].filter(Boolean).join(" ") : scenario.publicName;
  }, [context, scenario.publicName]);

  async function launchShim() {
    setIsBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        coverageId: selectedRequest.coverageId,
        requestResourceType: selectedRequest.requestResourceType,
        requestResourceId: selectedRequest.requestResourceId
      });
      const response = await fetch(`${API_BASE_URL}/context/patient/${selectedRequest.patientId}?${params.toString()}`);
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
      setAuditEvents([]);
      setOperationsHistory(null);
      setEvidenceList(null);
      try {
      const response = await fetch(`${API_BASE_URL}/requirements/evaluate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(selectedRequest)
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
      await refreshAudit(created.id);
      await refreshOperations(created.id);
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
      await refreshEvidence(workItem.id);
      await refreshStatus(workItem.id);
      await refreshAudit(workItem.id);
      await refreshOperations(workItem.id);
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
      await refreshAudit(pkg.workItemId);
      await refreshOperations(pkg.workItemId);
      await refreshEvidence(pkg.workItemId);
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
      await refreshAudit(workItem.id);
      await refreshOperations(workItem.id);
      await refreshEvidence(workItem.id);
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
      await refreshAudit(submissionPacket.workItemId);
      await refreshOperations(submissionPacket.workItemId);
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

  async function refreshAudit(workItemId: string) {
    setAuditEvents(await getJson<AuditEvent[]>(`/work-items/${workItemId}/audit`));
  }

  async function refreshEvidence(workItemId = workItem?.id) {
    if (!workItemId) {
      return;
    }
    setEvidenceList(await getJson<EvidenceListResponse>(`/work-items/${workItemId}/evidence`));
  }

  async function attachFixture(fixtureId: string) {
    if (!workItem) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await postJson<EvidenceAttachment>(`/work-items/${workItem.id}/evidence/attach-fixture`, {
        fixtureId,
        actorUserId: "m7-demo-operator"
      });
      await refreshEvidence(workItem.id);
      await refreshAudit(workItem.id);
      await refreshOperations(workItem.id);
    } catch (caught) {
      setError(formatCaught(caught, "Evidence fixture attach failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function uploadEvidence() {
    if (!workItem) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await postJson<EvidenceAttachment>(`/work-items/${workItem.id}/evidence/upload`, {
        filename: uploadFilename,
        contentType: "text/plain",
        base64Data: btoa(uploadContent),
        actorUserId: "m7-demo-operator"
      });
      await refreshEvidence(workItem.id);
      await refreshAudit(workItem.id);
      await refreshOperations(workItem.id);
    } catch (caught) {
      setError(formatCaught(caught, "Evidence upload failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function updateEvidenceStatus(evidenceId: string, action: "accept" | "remove") {
    if (!workItem) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await postJson<EvidenceAttachment>(`/work-items/${workItem.id}/evidence/${evidenceId}/${action}`, {
        actorUserId: "m7-demo-operator"
      });
      await refreshEvidence(workItem.id);
      await refreshAudit(workItem.id);
      await refreshOperations(workItem.id);
    } catch (caught) {
      setError(formatCaught(caught, `Evidence ${action} failed`));
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshOperations(workItemId = workItem?.id) {
    const params = new URLSearchParams();
    if (queueStatusFilter) {
      params.set("status", queueStatusFilter);
    }
    if (queueOwnerFilter) {
      params.set("owner", queueOwnerFilter);
    }
    params.set("sort", "age_desc");
    setQueueRows(await getJson<WorkItemQueueRow[]>(`/work-items?${params.toString()}`));
    setMetrics(await getJson<OperationsMetrics>("/operations/metrics"));
    if (workItemId) {
      setOperationsHistory(await getJson<WorkItemOperationsHistory>(`/work-items/${workItemId}/operations`));
    }
  }

  async function seedDemoCases() {
    setIsBusy(true);
    setError(null);
    try {
      const created = await postJson<WorkItem[]>("/demo/seed-work-items", {
        count: 3,
        scenarioId
      });
      const selected = created[0];
      setWorkItem(selected);
      setQuestionnairePackage(null);
      setFormResponse(null);
      setSubmissionPacket(null);
      setSubmissionReceipt(null);
      await refreshStatus(selected.id);
      await refreshAudit(selected.id);
      await refreshOperations(selected.id);
      await refreshEvidence(selected.id);
    } catch (caught) {
      setError(formatCaught(caught, "Demo case seeding failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function selectQueueRow(row: WorkItemQueueRow) {
    setIsBusy(true);
    setError(null);
    try {
      await refreshWorkItem(row.workItemId);
      setQuestionnairePackage(null);
      setFormResponse(null);
      setSubmissionPacket(null);
      setSubmissionReceipt(null);
      await refreshStatus(row.workItemId);
      await refreshAudit(row.workItemId);
      await refreshOperations(row.workItemId);
      await refreshEvidence(row.workItemId);
    } catch (caught) {
      setError(formatCaught(caught, "Queue selection failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function requestMoreInfo() {
    if (!workItem) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const moreInfo = moreInfoByServiceLine[workItem.serviceLine] ?? moreInfoByServiceLine.mri_lumbar_spine;
      await postJson(`/work-items/${workItem.id}/request-more-info`, {
        message: moreInfo.message,
        requestedItems: [
          {
            code: moreInfo.code,
            label: moreInfo.label,
            required: true
          }
        ],
        dueAt: "2026-05-02T00:00:00.000Z",
        actor: "mock-payer"
      });
      await refreshWorkItem(workItem.id);
      await refreshStatus(workItem.id);
      await refreshAudit(workItem.id);
      await refreshOperations(workItem.id);
    } catch (caught) {
      setError(formatCaught(caught, "More-info request failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function recordPayerStatus(status: PayerUpdateStatus) {
    if (!workItem) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      await postJson(`/work-items/${workItem.id}/record-payer-status`, {
        status,
        actor: "mock-payer",
        message: status === "pended" ? "Pending mock payer nurse review." : undefined,
        reason: status === "denied"
          ? {
              code: "insufficient-documentation",
              display: "Insufficient documentation",
              detail: "Conservative therapy duration was not documented."
            }
          : undefined
      });
      await refreshWorkItem(workItem.id);
      await refreshStatus(workItem.id);
      await refreshAudit(workItem.id);
      await refreshOperations(workItem.id);
    } catch (caught) {
      setError(formatCaught(caught, "Payer status update failed"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main>
      <section className="topBar">
        <div>
          <p className="eyebrow">M4 operations workbench demo</p>
          <h1>Open Prior Auth Workbench</h1>
          <p className="muted">{scenario.publicName}</p>
        </div>
        <div className="statusPill">Synthetic data only</div>
      </section>

      <section className="workspace">
        <aside className="rail">
          <label className="field compactField">
            <span>Scenario</span>
            <select
              value={scenarioId}
              onChange={(event) => {
                setScenarioId(event.target.value as typeof scenarioId);
                setContext(null);
                setEvaluation(null);
                setWorkItem(null);
                setQuestionnairePackage(null);
                setFormResponse(null);
                setSubmissionPacket(null);
                setSubmissionReceipt(null);
                setStatusEvents([]);
                setAuditEvents([]);
                setOperationsHistory(null);
                setEvidenceList(null);
              }}
            >
              {scenarioOptions.map((option) => (
                <option key={option.scenarioId} value={option.scenarioId}>
                  {option.publicName}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={launchShim} disabled={isBusy}>
            Launch shim
          </button>
          <button type="button" onClick={seedDemoCases} disabled={isBusy}>
            Seed demo cases
          </button>
          <button type="button" onClick={() => refreshOperations()} disabled={isBusy}>
            Refresh queue
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
          <button type="button" onClick={() => refreshEvidence()} disabled={isBusy || !workItem}>
            Refresh evidence
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
          <button type="button" onClick={() => recordPayerStatus("pended")} disabled={isBusy || !workItem || workItem.status !== "submitted"}>
            Mark pended
          </button>
          <button type="button" onClick={requestMoreInfo} disabled={isBusy || !workItem || workItem.status !== "submitted"}>
            Request more info
          </button>
          <button type="button" onClick={() => recordPayerStatus("approved")} disabled={isBusy || !workItem || workItem.status !== "submitted"}>
            Approve
          </button>
          <button type="button" onClick={() => recordPayerStatus("denied")} disabled={isBusy || !workItem || workItem.status !== "submitted"}>
            Deny
          </button>
          <button type="button" onClick={() => recordPayerStatus("cancelled")} disabled={isBusy || !workItem || workItem.status !== "submitted"}>
            Cancel case
          </button>
        </aside>

        <OperationsPanel
          rows={queueRows}
          metrics={metrics}
          history={operationsHistory}
          selectedWorkItemId={workItem?.id ?? null}
          statusFilter={queueStatusFilter}
          ownerFilter={queueOwnerFilter}
          onStatusFilterChange={setQueueStatusFilter}
          onOwnerFilterChange={setQueueOwnerFilter}
          onRefresh={() => refreshOperations()}
          onSelect={selectQueueRow}
        />

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
              <dd>{context?.request?.code?.text ?? context?.request?.codeCodeableConcept?.text ?? "Not loaded"}</dd>
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
          auditEvents={auditEvents}
        />

        <EvidencePanel
          evidence={evidenceList}
          disabled={isBusy || !workItem}
          uploadFilename={uploadFilename}
          uploadContent={uploadContent}
          onUploadFilenameChange={setUploadFilename}
          onUploadContentChange={setUploadContent}
          onAttachFixture={attachFixture}
          onUpload={uploadEvidence}
          onUpdateStatus={updateEvidenceStatus}
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
  events,
  auditEvents
}: {
  packet: SubmissionPacket | null;
  receipt: SubmissionReceipt | null;
  events: StatusEvent[];
  auditEvents: AuditEvent[];
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

      <div className="auditTrail">
        <p className="eyebrow">Audit trail</p>
        {auditEvents.length > 0 ? auditEvents.map((event) => (
          <div className="auditEvent" key={event.eventId}>
            <strong>{event.action}</strong>
            <span>{event.actor} - {event.resourceType}/{event.resourceId}</span>
            <small>{formatAuditTime(event.timestamp)}</small>
            <em>{event.beforeJson === null ? "Before empty" : "Before captured"} / {event.afterJson === null ? "After empty" : "After captured"}</em>
          </div>
        )) : (
          <p className="muted">Audit entries appear after a work item changes state.</p>
        )}
      </div>
    </section>
  );
}

function EvidencePanel({
  evidence,
  disabled,
  uploadFilename,
  uploadContent,
  onUploadFilenameChange,
  onUploadContentChange,
  onAttachFixture,
  onUpload,
  onUpdateStatus
}: {
  evidence: EvidenceListResponse | null;
  disabled: boolean;
  uploadFilename: string;
  uploadContent: string;
  onUploadFilenameChange: (value: string) => void;
  onUploadContentChange: (value: string) => void;
  onAttachFixture: (fixtureId: string) => void;
  onUpload: () => void;
  onUpdateStatus: (evidenceId: string, action: "accept" | "remove") => void;
}) {
  return (
    <section className="panel evidencePanel">
      <div className="panelHeader">
        <p className="eyebrow">Evidence attachments</p>
        <h2>{evidence ? `${evidence.attachments.length} attachment${evidence.attachments.length === 1 ? "" : "s"}` : "No evidence loaded"}</h2>
      </div>

      <div className="evidenceFixtures">
        {evidence?.availableFixtures.map((fixture) => (
          <button
            key={fixture.fixtureId}
            type="button"
            disabled={disabled}
            onClick={() => onAttachFixture(fixture.fixtureId)}
          >
            Attach {fixture.title}
          </button>
        )) ?? <p className="muted">Refresh evidence after creating a work item.</p>}
      </div>

      <div className="uploadBox">
        <label>
          <span>Filename</span>
          <input value={uploadFilename} disabled={disabled} onChange={(event) => onUploadFilenameChange(event.target.value)} />
        </label>
        <label>
          <span>Text upload content</span>
          <textarea value={uploadContent} disabled={disabled} onChange={(event) => onUploadContentChange(event.target.value)} />
        </label>
        <button type="button" disabled={disabled} onClick={onUpload}>Upload local text evidence</button>
      </div>

      <div className="evidenceList">
        {evidence?.attachments.length ? evidence.attachments.map((attachment) => (
          <div className="evidenceRow" key={attachment.id}>
            <span>
              <strong>{attachment.title}</strong>
              <em>{attachment.filename} - {attachment.contentType}</em>
            </span>
            <span>
              <strong>{attachment.status.replaceAll("-", " ")}</strong>
              <em>{attachment.contentMode.replaceAll("-", " ")}</em>
            </span>
            <span className="evidenceActions">
              <button type="button" disabled={disabled || attachment.status === "accepted" || attachment.status === "included-in-packet"} onClick={() => onUpdateStatus(attachment.id, "accept")}>Accept</button>
              <button type="button" disabled={disabled || attachment.status === "removed" || attachment.status === "included-in-packet"} onClick={() => onUpdateStatus(attachment.id, "remove")}>Remove</button>
            </span>
          </div>
        )) : (
          <p className="muted">Attach a synthetic fixture or upload a local text note before building the packet.</p>
        )}
      </div>
    </section>
  );
}

function OperationsPanel({
  rows,
  metrics,
  history,
  selectedWorkItemId,
  statusFilter,
  ownerFilter,
  onStatusFilterChange,
  onOwnerFilterChange,
  onRefresh,
  onSelect
}: {
  rows: WorkItemQueueRow[];
  metrics: OperationsMetrics | null;
  history: WorkItemOperationsHistory | null;
  selectedWorkItemId: string | null;
  statusFilter: string;
  ownerFilter: string;
  onStatusFilterChange: (value: string) => void;
  onOwnerFilterChange: (value: string) => void;
  onRefresh: () => void;
  onSelect: (row: WorkItemQueueRow) => void;
}) {
  const latestPayerUpdate = history?.payerUpdates.at(-1);
  const latestMoreInfo = history?.moreInfoRequests.at(-1);

  return (
    <section className="panel operationsPanel">
      <div className="panelHeader">
        <p className="eyebrow">Operations queue</p>
        <h2>{rows.length} case{rows.length === 1 ? "" : "s"} in view</h2>
      </div>

      <div className="queueFilters">
        <label>
          <span>Status filter</span>
          <input
            value={statusFilter}
            placeholder="submitted,pended"
            onChange={(event) => onStatusFilterChange(event.target.value)}
          />
        </label>
        <label>
          <span>Owner filter</span>
          <input
            value={ownerFilter}
            placeholder="unassigned"
            onChange={(event) => onOwnerFilterChange(event.target.value)}
          />
        </label>
        <button type="button" onClick={onRefresh}>Apply filters</button>
      </div>

      <div className="metricsStrip">
        <Metric label="Open" value={String(metrics?.openWorkItems ?? 0)} />
        <Metric label="Terminal" value={String(metrics?.terminalWorkItems ?? 0)} />
        <Metric label="Approval rate" value={formatRate(metrics?.approvalRate)} />
        <Metric label="Decision median" value={formatDuration(metrics?.medianSubmissionToDecisionMs)} />
      </div>

      <div className="queueList">
        {rows.length > 0 ? rows.map((row) => (
          <button
            className={row.workItemId === selectedWorkItemId ? "queueRow selectedQueueRow" : "queueRow"}
            key={row.workItemId}
            type="button"
            onClick={() => onSelect(row)}
          >
            <span>
              <strong>{row.patientName}</strong>
              <em>{row.serviceDescription}</em>
            </span>
            <span>
              <strong>{row.effectiveStatus.replaceAll("_", " ")}</strong>
              <em>{row.status === row.effectiveStatus ? "Internal status" : `Internal: ${row.status.replaceAll("_", " ")}`}</em>
            </span>
            <span>
              <strong>{formatDuration(row.ageMs)}</strong>
              <em>{row.nextAction}</em>
            </span>
          </button>
        )) : (
          <p className="muted">Seed demo cases or refresh the queue after creating a work item.</p>
        )}
      </div>

      <div className="operationsHistory">
        <p className="eyebrow">Selected case operations</p>
        {latestPayerUpdate ? (
          <p className="note">
            Latest payer update: {latestPayerUpdate.status}
            {latestPayerUpdate.reason ? ` - ${latestPayerUpdate.reason.display}: ${latestPayerUpdate.reason.detail}` : ""}
          </p>
        ) : (
          <p className="muted">No payer updates recorded.</p>
        )}
        {latestMoreInfo && (
          <p className="note">
            More info: {latestMoreInfo.message}
            {latestMoreInfo.resolvedAt ? " (resolved)" : ""}
          </p>
        )}
        {history?.operationEvents.slice(-4).map((event) => (
          <div className="timelineEvent" key={event.id}>
            <strong>{event.type.replaceAll("_", " ")}</strong>
            <span>{event.actor}</span>
            <small>{formatAuditTime(event.createdAt)}</small>
          </div>
        ))}
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

function formatAuditTime(timestamp: string): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function formatRate(value: number | null | undefined): string {
  return `${Math.round((value ?? 0) * 100)}%`;
}

function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "n/a";
  }
  if (value < 60_000) {
    return `${Math.round(value / 1000)}s`;
  }
  if (value < 3_600_000) {
    return `${Math.round(value / 60_000)}m`;
  }
  return `${Math.round(value / 3_600_000)}h`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
