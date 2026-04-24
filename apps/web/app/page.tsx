"use client";

import { useMemo, useState } from "react";
import type { RequirementEvaluationResult, WorkItem } from "@open-prior-auth/shared-types";

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
          ownerUserId: "m1-demo-operator"
        })
      });
      if (!response.ok) {
        throw new Error(`Work item creation failed with ${response.status}`);
      }
      setWorkItem(await response.json() as WorkItem);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Work item creation failed");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <main>
      <section className="topBar">
        <div>
          <p className="eyebrow">M1 standards sandbox</p>
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
                <dt>From evaluation</dt>
                <dd>{workItem.evaluationId}</dd>
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
      </section>

      {error && <p className="error">{error}</p>}
    </main>
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
