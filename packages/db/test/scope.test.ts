import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { openDb, runWithWorkspace } from "../src/index.ts";

test("a workspace sees only its own requests", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "scope-"));
  const db = openDb(path.join(dir, "scope.db"));
  runWithWorkspace("alpha", () => {
    db.run(
      "INSERT INTO requests (id, raw_message, status, created_at) VALUES (?, ?, 'triaged', ?)",
      ["r1", "hello from alpha", "2026-10-22T00:00:00.000Z"],
    );
  });
  runWithWorkspace("beta", () => {
    db.run(
      "INSERT INTO requests (id, raw_message, status, created_at) VALUES (?, ?, 'triaged', ?)",
      ["r2", "hello from beta", "2026-10-22T00:00:00.000Z"],
    );
    const rows = db.all<{ id: string }>("SELECT id FROM requests ORDER BY id");
    assert.deepEqual(rows.map((row) => row.id), ["r2"]);
  });
  runWithWorkspace("alpha", () => {
    const rows = db.all<{ id: string }>("SELECT id FROM requests");
    assert.deepEqual(rows.map((row) => row.id), ["r1"]);
    const limited = db.all<{ id: string }>("SELECT id FROM requests ORDER BY created_at DESC LIMIT ?", [5]);
    assert.deepEqual(limited.map((row) => row.id), ["r1"]);
  });
  const all = db.all<{ id: string }>("SELECT id FROM requests ORDER BY id");
  assert.deepEqual(all.map((row) => row.id), ["r1", "r2"]);
  db.close();
});

test("shared sponsor rows stay visible in every workspace", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "scope-shared-"));
  const db = openDb(path.join(dir, "scope.db"));
  db.run("INSERT INTO sponsors (id, company) VALUES (?, ?)", ["sp1", "Tessl"]);
  runWithWorkspace("alpha", () => {
    const row = db.get<{ company: string }>("SELECT company FROM sponsors WHERE id = ?", ["sp1"]);
    assert.equal(row?.company, "Tessl");
  });
  db.close();
});
