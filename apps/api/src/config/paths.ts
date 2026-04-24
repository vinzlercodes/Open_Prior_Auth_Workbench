import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

export function resolveFromRepoRoot(relativePath: string): string {
  return resolve(findRepoRoot(), relativePath);
}

function findRepoRoot(start = process.cwd()): string {
  let current = start;

  while (true) {
    if (existsSync(resolve(current, "data")) && existsSync(resolve(current, "package.json"))) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      throw new Error(`Could not find repository root from ${start}`);
    }
    current = parent;
  }
}
