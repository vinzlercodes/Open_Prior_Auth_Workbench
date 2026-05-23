# M1b Doctor ToolNet Demo

M1b adds `@open-prior-auth/doctor-toolnet`, an agent-facing tool adapter over Prior Auth Core.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

Expected:

- ToolNet package builds.
- `tests/doctor-toolnet.contract.test.mjs` passes.
- Existing API/UI contract tests still pass.
- Source boundary checks prove ToolNet does not import `apps/api`, call local HTTP routes, or fetch local servers.

## Example Tool Call

```ts
import { executeDoctorTool } from "@open-prior-auth/doctor-toolnet";

const result = await executeDoctorTool({
  toolName: "doctor.case.get",
  input: { workItemId: "wi-mri-lumbar-001" },
  callContext: { actorUserId: "demo-user" }
}, {
  repository,
  store
});
```

Guarded tools are visible but blocked:

```ts
const result = await executeDoctorTool({
  toolName: "doctor.pas.submit_mock",
  input: { packetId: "packet-001", actorUserId: "demo-user" }
}, {
  repository,
  store
});

// result.ok === false
// result.error.code === "APPROVAL_EXECUTOR_REQUIRED"
```
