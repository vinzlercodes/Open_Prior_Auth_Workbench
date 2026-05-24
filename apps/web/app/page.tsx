"use client";

import { useMemo, useState } from "react";
import type {
  AuditEvent,
  EvidenceListResponse,
  MoreInfoRequest,
  PayerUpdateStatus,
  QuestionnairePackage,
  StatusEvent,
  SubmissionPacket,
  WorkItem,
  WorkItemOperationsHistory,
  WorkItemQueueRow
} from "@open-prior-auth/shared-types";

type AgentRunStatus = "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
type AgentStepStatus = "pending" | "running" | "waiting_for_human" | "completed" | "rejected" | "failed";
type ApprovalStatus = "pending" | "approved" | "rejected";

interface AgentCockpitTraceEvent {
  sequence: number;
  eventId: string;
  type: string;
  actor: string;
  at: string;
  message: string;
}

interface AgentCockpitRunResponse {
  workItem: WorkItem;
  run: {
    id: string;
    status: AgentRunStatus;
  };
  steps: Array<{
    agent: string;
    status: AgentStepStatus;
    summary: string;
    toolName?: string;
  }>;
  trace: AgentCockpitTraceEvent[];
  questionnaireApproval: {
    status: ApprovalStatus;
    toolName: string;
  };
  submitApproval: {
    status: ApprovalStatus;
    toolName: string;
  };
  questionnairePackage: QuestionnairePackage;
  evidence: EvidenceListResponse;
  evidenceBoard: Array<{
    requirementCode: string;
    requirementLabel: string;
    requirementDetail: string;
    sourceLabel: string;
    status: string;
    fixtureIds: string[];
    evidenceAttachmentIds: string[];
  }>;
  packet: SubmissionPacket;
  statusTimeline: StatusEvent[];
  auditTrace: AuditEvent[];
}

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

export default function Home() {
  const [scenarioId, setScenarioId] = useState(scenarioOptions[0].scenarioId);
  const [queueRows, setQueueRows] = useState<WorkItemQueueRow[]>([]);
  const [workItem, setWorkItem] = useState<WorkItem | null>(null);
  const [operationsHistory, setOperationsHistory] = useState<WorkItemOperationsHistory | null>(null);
  const [statusEvents, setStatusEvents] = useState<StatusEvent[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [questionnairePackage, setQuestionnairePackage] = useState<QuestionnairePackage | null>(null);
  const [evidenceList, setEvidenceList] = useState<EvidenceListResponse | null>(null);
  const [submissionPacket, setSubmissionPacket] = useState<SubmissionPacket | null>(null);
  const [agentRun, setAgentRun] = useState<AgentCockpitRunResponse | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scenario = scenarioOptions.find((candidate) => candidate.scenarioId === scenarioId) ?? scenarioOptions[0];
  const latestMoreInfo = operationsHistory?.moreInfoRequests.at(-1);
  const latestPayerUpdate = operationsHistory?.payerUpdates.at(-1);
  const nextAction = useMemo(() => describeNextAction(workItem, agentRun, latestMoreInfo), [workItem, agentRun, latestMoreInfo]);
  const caseSummary = workItem?.requirementResult.requestSummary;

  async function seedDemoCases() {
    setIsBusy(true);
    setError(null);
    try {
      const created = await postJson<WorkItem[]>("/demo/seed-work-items", {
        count: 2,
        scenarioId,
        ownerUserId: "m5-cockpit-operator"
      });
      await loadCase(created[0].id, { resetAgentRun: true });
    } catch (caught) {
      setError(formatCaught(caught, "Demo case seeding failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function refreshQueue() {
    setIsBusy(true);
    setError(null);
    try {
      setQueueRows(await getJson<WorkItemQueueRow[]>("/work-items?sort=age_desc"));
    } catch (caught) {
      setError(formatCaught(caught, "Queue refresh failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function selectQueueRow(row: WorkItemQueueRow) {
    setIsBusy(true);
    setError(null);
    try {
      await loadCase(row.workItemId, { resetAgentRun: true });
    } catch (caught) {
      setError(formatCaught(caught, "Case load failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function runAgentTeam() {
    if (!workItem) {
      return;
    }
    setIsBusy(true);
    setError(null);
    try {
      const response = await postJson<AgentCockpitRunResponse>("/agent-runs/prior-auth-deterministic", {
        workItemId: workItem.id,
        actorUserId: "m5-cockpit-operator"
      });
      setAgentRun(response);
      setWorkItem(response.workItem);
      setQuestionnairePackage(response.questionnairePackage);
      setEvidenceList(response.evidence);
      setSubmissionPacket(response.packet);
      setStatusEvents(response.statusTimeline);
      setAuditEvents(response.auditTrace);
      await refreshOperations(response.workItem.id);
    } catch (caught) {
      setError(formatCaught(caught, "Agent run failed"));
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
        requestedItems: [{ code: moreInfo.code, label: moreInfo.label, required: true }],
        dueAt: "2026-05-02T00:00:00.000Z",
        actor: "mock-payer"
      });
      await loadCase(workItem.id, { resetAgentRun: false });
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
      await loadCase(workItem.id, { resetAgentRun: false });
    } catch (caught) {
      setError(formatCaught(caught, "Payer status update failed"));
    } finally {
      setIsBusy(false);
    }
  }

  async function loadCase(workItemId: string, options: { resetAgentRun: boolean }) {
    const [loadedWorkItem, loadedStatus, loadedAudit, loadedEvidence] = await Promise.all([
      getJson<WorkItem>(`/work-items/${workItemId}`),
      getJson<StatusEvent[]>(`/work-items/${workItemId}/status`),
      getJson<AuditEvent[]>(`/work-items/${workItemId}/audit`),
      getJson<EvidenceListResponse>(`/work-items/${workItemId}/evidence`)
    ]);
    setWorkItem(loadedWorkItem);
    setStatusEvents(loadedStatus);
    setAuditEvents(loadedAudit);
    setEvidenceList(loadedEvidence);
    setQuestionnairePackage(null);
    setSubmissionPacket(null);
    if (options.resetAgentRun) {
      setAgentRun(null);
    }
    await refreshOperations(workItemId);
  }

  async function refreshOperations(workItemId?: string) {
    const [rows, history] = await Promise.all([
      getJson<WorkItemQueueRow[]>("/work-items?sort=age_desc"),
      workItemId ? getJson<WorkItemOperationsHistory>(`/work-items/${workItemId}/operations`) : Promise.resolve(null)
    ]);
    setQueueRows(rows);
    setOperationsHistory(history);
  }

  return (
    <main>
      <section className="cockpitHeader">
        <div className="identity">
          <p className="eyebrow">M5 Agent Cockpit</p>
          <h1>{caseSummary?.patientName ?? scenario.publicName}</h1>
          <p className="muted">
            {caseSummary
              ? `${caseSummary.serviceDescription} - ${caseSummary.payerName}`
              : "Seed or select a synthetic case to begin."}
          </p>
        </div>
        <div className="headerControls">
          <label className="controlField">
            <span>Scenario</span>
            <select
              value={scenarioId}
              onChange={(event) => {
                setScenarioId(event.target.value as typeof scenarioId);
                setWorkItem(null);
                setOperationsHistory(null);
                setStatusEvents([]);
                setAuditEvents([]);
                setQuestionnairePackage(null);
                setEvidenceList(null);
                setSubmissionPacket(null);
                setAgentRun(null);
              }}
            >
              {scenarioOptions.map((option) => (
                <option key={option.scenarioId} value={option.scenarioId}>{option.publicName}</option>
              ))}
            </select>
          </label>
          <div className="statusStack">
            <span className="statusPill">Synthetic data only</span>
            <strong>{workItem ? titleCase(workItem.status) : "No case selected"}</strong>
          </div>
        </div>
      </section>

      <section className="commandBand">
        <button type="button" onClick={seedDemoCases} disabled={isBusy}>Seed selected scenario</button>
        <button type="button" onClick={refreshQueue} disabled={isBusy}>Refresh queue</button>
        <button type="button" onClick={runAgentTeam} disabled={isBusy || !workItem || Boolean(agentRun?.submitApproval.status === "pending")}>
          Run deterministic agent team
        </button>
        <button type="button" onClick={() => recordPayerStatus("pended")} disabled={isBusy || workItem?.status !== "submitted"}>Mark pended</button>
        <button type="button" onClick={requestMoreInfo} disabled={isBusy || workItem?.status !== "submitted"}>Request more info</button>
        <button type="button" onClick={() => recordPayerStatus("approved")} disabled={isBusy || workItem?.status !== "submitted"}>Approve</button>
        <button type="button" onClick={() => recordPayerStatus("denied")} disabled={isBusy || workItem?.status !== "submitted"}>Deny</button>
      </section>

      <section className="caseGrid">
        <section className="panel nextActionPanel">
          <div className="panelHeader">
            <p className="eyebrow">Current blocker / next action</p>
            <h2>{nextAction.title}</h2>
          </div>
          <p className="largeNote">{nextAction.detail}</p>
          <div className="miniFacts">
            <Metric label="Work item" value={workItem?.id ?? "None"} />
            <Metric label="Owner" value={workItem?.ownerUserId ?? "Unassigned"} />
            <Metric label="Latest payer update" value={latestPayerUpdate?.status ?? "None"} />
            <Metric label="More info" value={formatMoreInfo(latestMoreInfo)} />
          </div>
        </section>

        <section className="panel queuePanel">
          <div className="panelHeader">
            <p className="eyebrow">Case queue</p>
            <h2>{queueRows.length} case{queueRows.length === 1 ? "" : "s"}</h2>
          </div>
          <div className="queueList">
            {queueRows.length > 0 ? queueRows.map((row) => (
              <button
                className={row.workItemId === workItem?.id ? "queueRow selectedQueueRow" : "queueRow"}
                key={row.workItemId}
                type="button"
                onClick={() => selectQueueRow(row)}
              >
                <span>
                  <strong>{row.patientName}</strong>
                  <em>{row.serviceDescription}</em>
                </span>
                <span>
                  <strong>{titleCase(row.effectiveStatus)}</strong>
                  <em>{row.nextAction}</em>
                </span>
              </button>
            )) : (
              <p className="muted">Seed demo cases or refresh queue.</p>
            )}
          </div>
        </section>

        <AgentTimeline run={agentRun} />
        <EvidenceBoard run={agentRun} evidence={evidenceList} />
        <QuestionnaireSummary pkg={questionnairePackage} />
        <PacketPreview packet={submissionPacket} />
        <BusinessTimeline events={statusEvents} auditEvents={auditEvents} />
      </section>

      {error && <p className="error">{error}</p>}
    </main>
  );
}

function AgentTimeline({ run }: { run: AgentCockpitRunResponse | null }) {
  const visibleTrace = run?.trace.filter((event) =>
    event.type.startsWith("agent.")
    || event.type === "run.started"
    || event.type === "approval.requested"
    || event.type === "approval.approved"
    || event.type === "tool_call.succeeded"
  ) ?? [];

  return (
    <section className="panel timelinePanel">
      <div className="panelHeader splitHeader">
        <div>
          <p className="eyebrow">Agent run timeline</p>
          <h2>{run ? `${run.run.id} - ${titleCase(run.run.status)}` : "No run yet"}</h2>
        </div>
        {run?.submitApproval && <span className="warningPill">{titleCase(run.submitApproval.status)} submit approval</span>}
      </div>
      {run ? (
        <>
          <div className="stepStrip">
            {run.steps.map((step) => (
              <div className="stepCard" key={`${step.agent}-${step.toolName ?? step.summary}`}>
                <strong>{titleCase(step.agent)}</strong>
                <span>{step.toolName ?? "agent step"}</span>
                <em>{titleCase(step.status)}</em>
              </div>
            ))}
          </div>
          <div className="traceList">
            {visibleTrace.map((event) => <TraceEventRow event={event} key={event.eventId} />)}
          </div>
        </>
      ) : (
        <p className="muted">Run the deterministic agent team after selecting a work item.</p>
      )}
    </section>
  );
}

function TraceEventRow({ event }: { event: AgentCockpitTraceEvent }) {
  return (
    <div className="traceRow">
      <strong>{event.sequence}. {event.type}</strong>
      <span>{event.message}</span>
      <small>{event.actor} - {formatTime(event.at)}</small>
    </div>
  );
}

function EvidenceBoard({
  run,
  evidence
}: {
  run: AgentCockpitRunResponse | null;
  evidence: EvidenceListResponse | null;
}) {
  const rows = run?.evidenceBoard ?? [];

  return (
    <section className="panel evidencePanel">
      <div className="panelHeader">
        <p className="eyebrow">Evidence-to-requirement board</p>
        <h2>{rows.length ? `${rows.length} requirement checks` : "No board loaded"}</h2>
      </div>
      {rows.length > 0 ? (
        <div className="evidenceBoard">
          {rows.map((row) => (
            <div className="evidenceRequirement" key={row.requirementCode}>
              <span>
                <strong>{row.requirementLabel}</strong>
                <em>{row.requirementDetail}</em>
              </span>
              <span>
                <strong>{titleCase(row.status)}</strong>
                <em>{row.sourceLabel}</em>
              </span>
              <span>
                <strong>{row.evidenceAttachmentIds.length} attached</strong>
                <em>{row.fixtureIds.length} fixture{row.fixtureIds.length === 1 ? "" : "s"} available</em>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="muted">
          {evidence ? `${evidence.availableFixtures.length} fixtures available before agent run.` : "Evidence loads after case selection."}
        </p>
      )}
    </section>
  );
}

function QuestionnaireSummary({ pkg }: { pkg: QuestionnairePackage | null }) {
  return (
    <section className="panel summaryPanel">
      <div className="panelHeader">
        <p className="eyebrow">Questionnaire package summary</p>
        <h2>{pkg ? pkg.questionnaire.title ?? pkg.questionnaireCanonical : "No package loaded"}</h2>
      </div>
      {pkg ? (
        <div className="miniFacts">
          <Metric label="Completion" value={`${pkg.completion.requiredAnswered}/${pkg.completion.requiredTotal} required`} />
          <Metric label="Validation" value={pkg.validation.valid ? "Valid" : `${pkg.validation.issues.length} issue(s)`} />
          <Metric label="Revision" value={String(pkg.session.revision)} />
          <Metric label="Prefill sources" value={String(pkg.prefill.length)} />
        </div>
      ) : (
        <p className="muted">Agent run opens and saves the deterministic DTR package.</p>
      )}
    </section>
  );
}

function PacketPreview({ packet }: { packet: SubmissionPacket | null }) {
  const claim = packet?.bundle.entry.find((entry) => entry.resource.resourceType === "Claim")?.resource;

  return (
    <section className="panel summaryPanel">
      <div className="panelHeader">
        <p className="eyebrow">Packet preview</p>
        <h2>{packet ? packet.id : "No packet built"}</h2>
      </div>
      {packet ? (
        <div className="miniFacts">
          <Metric label="Schema" value={packet.packetSchemaVersion} />
          <Metric label="Transport" value={packet.transport} />
          <Metric label="Claim use" value={String(claim?.use ?? "Unknown")} />
          <Metric label="Attachments" value={String(packet.attachmentManifest.attachments.length)} />
        </div>
      ) : (
        <p className="muted">Packet preview appears after agent packet assembly.</p>
      )}
    </section>
  );
}

function BusinessTimeline({
  events,
  auditEvents
}: {
  events: StatusEvent[];
  auditEvents: AuditEvent[];
}) {
  return (
    <section className="panel businessPanel">
      <div className="panelHeader">
        <p className="eyebrow">Audit / status timeline</p>
        <h2>{events.length + auditEvents.length} recorded events</h2>
      </div>
      <div className="dualTimeline">
        <div className="timelineColumn">
          <h3>Status</h3>
          {events.length > 0 ? events.map((event) => (
            <div className="timelineEvent" key={event.eventId}>
              <strong>{titleCase(event.toStatus)}</strong>
              <span>{event.fromStatus ? `${titleCase(event.fromStatus)} -> ` : ""}{event.causedBy}</span>
              <small>{event.actor} - {formatTime(event.at)}</small>
            </div>
          )) : <p className="muted">No status events yet.</p>}
        </div>
        <div className="timelineColumn">
          <h3>Audit</h3>
          {auditEvents.length > 0 ? auditEvents.slice(-8).map((event) => (
            <div className="timelineEvent" key={event.eventId}>
              <strong>{event.action}</strong>
              <span>{event.resourceType}/{event.resourceId}</span>
              <small>{event.actor} - {formatTime(event.timestamp)}</small>
            </div>
          )) : <p className="muted">No audit events yet.</p>}
        </div>
      </div>
    </section>
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

function describeNextAction(
  workItem: WorkItem | null,
  run: AgentCockpitRunResponse | null,
  moreInfo: MoreInfoRequest | undefined
): { title: string; detail: string } {
  if (!workItem) {
    return {
      title: "Select or seed a case",
      detail: "Start from a synthetic MRI or DME work item. Case state stays primary; agent trace appears only after an explicit run."
    };
  }
  if (run?.submitApproval.status === "pending") {
    return {
      title: "Human approval required",
      detail: `${run.submitApproval.toolName} is paused at ApprovalGate. Packet preview is ready; mock PAS submit has not executed.`
    };
  }
  if (moreInfo && !moreInfo.resolvedAt) {
    return {
      title: "Respond to payer more-info request",
      detail: moreInfo.message
    };
  }
  if (workItem.status === "requirements_found") {
    return {
      title: "Run deterministic agent team",
      detail: "Agent will inspect requirements, draft questionnaire response, assemble evidence context, build packet, and pause before submit."
    };
  }
  if (workItem.status === "submitted") {
    return {
      title: "Await payer update",
      detail: "Use mock payer controls to mark pended, request more information, approve, or deny."
    };
  }
  return {
    title: titleCase(workItem.status),
    detail: workItem.requirementResult.explanatoryNotes.at(-1) ?? workItem.requirementResult.nextAction
  };
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`);
  }
  return await response.json() as T;
}

async function postJson<T = unknown>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${path} failed with ${response.status}: ${text}`);
  }
  return await response.json() as T;
}

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function formatMoreInfo(value: MoreInfoRequest | undefined): string {
  if (!value) {
    return "None";
  }
  return value.resolvedAt ? "Resolved" : "Open";
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatCaught(caught: unknown, fallback: string): string {
  return caught instanceof Error ? caught.message : fallback;
}
