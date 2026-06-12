import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

function workflowFiles() {
  const directory = resolve(process.cwd(), ".github/workflows");
  return readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
    .map((fileName) => join(directory, fileName));
}

function workflowUsesRefs(source) {
  return [...source.matchAll(/uses:\s+([^\s#]+)/g)].map((match) => match[1]);
}

test("security workflow contains portable gates for CodeQL, dependency review, gitleaks, and action pin audit", () => {
  const source = readFileSync(resolve(process.cwd(), ".github/workflows/security.yml"), "utf8");

  assert.match(source, /github\/codeql-action\/init@[a-f0-9]{40}/);
  assert.match(source, /github\/codeql-action\/analyze@[a-f0-9]{40}/);
  assert.match(source, /actions\/dependency-review-action@[a-f0-9]{40}/);
  assert.match(source, /gitleaks\/gitleaks-action@[a-f0-9]{40}/);
  assert.match(source, /zgosalvez\/github-actions-ensure-sha-pinned-actions@[a-f0-9]{40}/);
  assert.match(source, /source tag: github\/codeql-action@v4/);
  assert.match(source, /source tag: actions\/dependency-review-action@v5\.0\.0/);
  assert.match(source, /source tag: gitleaks\/gitleaks-action@v3/);
});

test("all workflow actions are pinned to immutable SHAs", () => {
  for (const path of workflowFiles()) {
    const source = readFileSync(path, "utf8");
    for (const reference of workflowUsesRefs(source)) {
      assert.match(reference, /@[a-f0-9]{40}$/, `${path} uses unpinned action ${reference}`);
    }
  }
});
