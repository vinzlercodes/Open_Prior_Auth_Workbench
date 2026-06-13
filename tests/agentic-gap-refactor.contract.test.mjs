import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

test("API server is a thin compatibility export over HTTP modules", () => {
  const serverSource = readFileSync(resolve(process.cwd(), "apps/api/src/server.ts"), "utf8");

  assert.ok(serverSource.length < 600);
  assert.ok(serverSource.includes("./http/createServer.js"));
  assert.ok(!serverSource.includes("if (request.method"));
  assert.ok(existsSync(resolve(process.cwd(), "apps/api/src/http/createServer.ts")));
  assert.ok(existsSync(resolve(process.cwd(), "apps/api/src/http/router.ts")));
  assert.ok(existsSync(resolve(process.cwd(), "apps/api/src/http/responses.ts")));
});

test("web cockpit page delegates presentational panels to components", () => {
  const pageSource = readFileSync(resolve(process.cwd(), "apps/web/app/page.tsx"), "utf8");

  assert.ok(pageSource.length < 17000);
  assert.ok(pageSource.includes("../components/cockpit-panels"));
  assert.ok(!pageSource.includes("function AgentTimeline"));
  assert.ok(!pageSource.includes("function EvidenceBoard"));
  assert.ok(existsSync(resolve(process.cwd(), "apps/web/components/cockpit-panels.tsx")));
});
