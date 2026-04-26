# M5 OSS Polish Tracker

## Plan

- [x] Verify existing Apache-2.0 license and surface it in the external README.
- [x] Add contributor, security, code-of-conduct, environment, fixture, architecture, and automation recipe docs.
- [x] Add GitHub Actions CI for Node 22 and Node 24.
- [x] Update demo documentation with deterministic screenshot expectations.
- [x] Capture seven deterministic screenshots from the synthetic local demo.
- [x] Run `npm test`, `npm run typecheck`, and `npm run build`.
- [x] Run local API/web smoke verification and confirm docs links reference real files.

## Review

- Verified the existing repo-root `LICENSE` is Apache-2.0 and referenced it from `README.md`.
- Added M5 OSS-facing docs: `CONTRIBUTING.md`, humble `SECURITY.md`, `CODE_OF_CONDUCT.md`, `.env.example`, `data/README.md`, `docs/architecture/m5_oss_polish.md`, and `examples/automations/README.md`.
- Added GitHub Actions CI with Node 22 and Node 24 matrix coverage and the expected install, test, typecheck, and build steps.
- Updated `demo/README.md` and added `demo/screenshots/README.md` with deterministic screenshot scope, seed command, actual checked-in capture dimensions, preferred future desktop viewport, and proof points.
- Captured seven requested PNG screenshots in `demo/screenshots/` and removed temporary JPEG capture files after user approval.
- Verified all local markdown links in M5 docs resolve.
- `npm test` passed with 38 tests using localhost permission for route-level API tests.
- `npm run typecheck` passed across API, web, and shared-types workspaces.
- `npm run build` passed across API, web, and shared-types workspaces.
- Local smoke verification passed: API health returned `status: ok`, the web app returned HTTP 200 on port 3001, demo seeding created one synthetic case, and the queue returned one row.
