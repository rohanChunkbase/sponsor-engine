import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { repoRoot } from "@sponsor-engine/db";

const REMOVED = ["PricingHistoryRow", "PricingQuote", "PricingRequest"];

test("core pricing types are exported before any file imports them", () => {
  const pricing = path.join(repoRoot(), "packages/core/src/pricing.ts");
  const types = readFileSync(path.join(repoRoot(), "packages/core/src/types.ts"), "utf8");
  if (!existsSync(pricing)) return;
  const source = readFileSync(pricing, "utf8");
  for (const name of REMOVED) {
    if (!source.includes(name)) continue;
    assert.match(types, new RegExp(`export (?:type|interface) ${name}\\b`), name);
  }
});
