import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  });
}

test("packages do not import application adapters", () => {
  const offenders = sourceFiles(resolve(process.cwd(), "packages"))
    .filter((file) => file.endsWith(".ts"))
    .filter((file) => readFileSync(file, "utf8").includes("\"../../apps/")
      || readFileSync(file, "utf8").includes("\"../apps/")
      || readFileSync(file, "utf8").includes("from \"apps/"));

  assert.deepEqual(offenders, []);
});
