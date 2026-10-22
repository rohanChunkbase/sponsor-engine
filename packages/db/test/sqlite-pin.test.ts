import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { repoRoot } from "../src/index.ts";

test("better-sqlite3 stays on a build that Node 20 and Node 22 can install", () => {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot(), "packages/db/package.json"), "utf8")) as {
    dependencies: Record<string, string>;
    engines: { node: string };
  };
  assert.equal(pkg.dependencies["better-sqlite3"], "12.9.0");
  assert.match(pkg.engines.node, />=20/);
  const lock = JSON.parse(readFileSync(path.join(repoRoot(), "package-lock.json"), "utf8")) as {
    packages: Record<string, { version?: string }>;
  };
  assert.equal(lock.packages["packages/db/node_modules/better-sqlite3"]?.version, "12.9.0");
});
