# Sample Automation Recipes

These recipes are docs-only examples for external builders. They call existing local APIs and do not add n8n, Slack, email, or helpdesk systems as canonical workflow state.

Use only synthetic local data while trying these recipes.

```bash
export API_BASE="http://127.0.0.1:4000"
```

## Queue Aging Digest

Purpose: summarize open work items that need operational attention.

Suggested trigger: scheduled job, local cron, n8n schedule trigger, or manual run.

Example API calls:

```bash
curl -s "$API_BASE/work-items?sort=age_desc" | jq 'map({
  workItemId,
  patientName,
  effectiveStatus,
  ownerUserId,
  ageHours: (.ageMs / 3600000 | floor),
  nextAction
})'

curl -s "$API_BASE/operations/metrics" | jq '{
  totalWorkItems,
  openWorkItems,
  terminalWorkItems,
  countsByEffectiveStatus,
  agingBuckets
}'
```

Implementation note: send only synthetic summary fields to external systems. Do not forward full FHIR bundles or questionnaire responses.

## More-Info Alert

Purpose: notify an operator when a mock payer requests additional information.

Suggested trigger: poll `GET /work-items?status=more_info_needed&sort=updated_desc`.

Example API call:

```bash
curl -s "$API_BASE/work-items?status=more_info_needed&sort=updated_desc" | jq 'map({
  workItemId,
  patientName,
  payerName,
  latestMoreInfoRequest,
  nextAction
})'
```

Implementation note: link operators back to the local workbench instead of copying clinical details into chat or email.

## Terminal Outcome Notification

Purpose: notify a team when a synthetic case reaches `approved`, `denied`, or `cancelled`.

Suggested trigger: poll terminal statuses and compare against the last delivered work item IDs in the automation tool.

Example API call:

```bash
curl -s "$API_BASE/work-items?status=approved,denied,cancelled&sort=updated_desc" | jq 'map({
  workItemId,
  patientName,
  effectiveStatus,
  decidedAt,
  latestPayerUpdate
})'
```

Implementation note: denial reasons in this demo are mock-payer examples. They are not real payer decisions and should not be used for clinical, billing, or appeal workflows.
