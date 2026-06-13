"use client";

import type {
  AuditEvent,
  EvidenceListResponse,
  QuestionnairePackage,
  StatusEvent,
  SubmissionPacket
} from "@open-prior-auth/shared-types";
import type { AgentCockpitRunResponse, AgentCockpitTraceEvent } from "../app/cockpitTypes";

export function AgentTimeline({ run }: { run: AgentCockpitRunResponse | null }) {
  const visibleTrace = run?.trace.filter((event) =>
    event.type.startsWith("agent.")
    || event.type === "run.started"
    || event.type === "approval.requested"
    || event.type === "approval.approved"
    || event.type === "tool_call.succeeded"
    || event.type === "policy.checked"
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
        <p className="muted">Run the deterministic replay planner after selecting a work item.</p>
      )}
    </section>
  );
}

export function EvidenceBoard({
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

export function QuestionnaireSummary({ pkg }: { pkg: QuestionnairePackage | null }) {
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

export function PacketPreview({ packet }: { packet: SubmissionPacket | null }) {
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

export function BusinessTimeline({
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

export function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
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

function titleCase(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}
