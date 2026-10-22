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
  const web = JSON.parse(readFileSync(path.join(repoRoot(), "apps/web/package.json"), "utf8")) as {
    dependencies: Record<string, string>;
  };
  assert.equal(web.dependencies["better-sqlite3"], "12.9.0");
  const lock = JSON.parse(readFileSync(path.join(repoRoot(), "package-lock.json"), "utf8")) as {
    packages: Record<string, { version?: string }>;
  };
  const installed = Object.entries(lock.packages).filter(([key]) => key.endsWith("node_modules/better-sqlite3"));
  assert.ok(installed.length > 0);
  for (const [, entry] of installed) assert.equal(entry.version, "12.9.0");
});
