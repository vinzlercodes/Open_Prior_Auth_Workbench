# M1a Prior Auth Core Verification

M1a extracts provider-side prior authorization Use Cases into `@open-prior-auth/prior-auth-core` while keeping API/UI behavior unchanged.

## Commands

```bash
npm run build -w @open-prior-auth/shared-types
npm run build -w @open-prior-auth/prior-auth-core
npm run build -w @open-prior-auth/api
npm test
npm run typecheck
npm run build
```

## Expected Results

- `prior-auth-core` builds cleanly.
- `npm test` passes all contract tests, including core boundary and core use-case coverage.
- `prior-auth-core` source has no `apps/api`, `../apps`, or `doctor-toolnet` imports.
- API routes continue returning existing response shapes.
- M1a itself did not require database table renames; current ToolNet coverage lives in `@open-prior-auth/doctor-toolnet`.
