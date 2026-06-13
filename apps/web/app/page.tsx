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
import { getJson, postJson } from "./apiClient";
import type { AgentCockpitRunResponse } from "./cockpitTypes";
import {
  AgentTimeline,
  BusinessTimeline,
  EvidenceBoard,
  Metric,
  PacketPreview,
  QuestionnaireSummary
} from "../components/cockpit-panels";

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
          Run replay planner
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
      title: "Run replay planner",
      detail: "Replay planner will inspect requirements, draft questionnaire response, assemble evidence context, build packet, and pause before submit."
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
