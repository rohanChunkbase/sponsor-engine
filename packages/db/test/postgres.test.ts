import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import os from "node:os";
import { dbDriver, defaultDbPath, openDb, repoRoot, seed } from "../src/index.ts";
import { postgresOptions } from "../src/pg-options.mjs";
import { splitSql } from "../src/sql.ts";

const TABLES = [
  "communities",
  "events",
  "sponsors",
  "sponsor_claims",
  "bookings",
  "requests",
  "tasks",
  "quotes",
  "outbox",
  "approvals",
  "agent_runs",
  "failures",
  "venue_files",
  "sponsor_suppression",
];

test("postgres.js uses the transaction pooler settings", () => {
  const options = postgresOptions("postgresql://postgres.example:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres");
  assert.equal(options.prepare, false);
  assert.equal(options.max, 1);
  assert.equal(options.fetch_types, false);
  assert.equal(options.ssl && typeof options.ssl === "object" && "rejectUnauthorized" in options.ssl, true);
  const local = postgresOptions("postgresql://postgres:pw@127.0.0.1:5432/postgres");
  assert.equal(local.ssl, false);
  assert.equal(local.prepare, false);
});

test("the postgres schema is one idempotent file with row level security", () => {
  const file = path.join(repoRoot(), "packages/db/src/schema.postgres.sql");
  const sql = readFileSync(file, "utf8");
  assert.match(sql, /rcoxklwwitbuugcndwto/);
  assert.doesNotMatch(sql, /CREATE TABLE (?!IF NOT EXISTS)/);
  assert.doesNotMatch(sql, /CREATE INDEX (?!IF NOT EXISTS)/);
  assert.doesNotMatch(sql, /FORCE ROW LEVEL SECURITY/);
  for (const table of TABLES) {
    assert.match(sql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
    assert.match(sql, new RegExp(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`));
    assert.match(sql, new RegExp(`REVOKE ALL ON TABLE ${table} FROM PUBLIC`));
  }
  assert.match(sql, /REVOKE ALL ON TABLE %I FROM anon/);
  assert.match(sql, /REVOKE ALL ON TABLE %I FROM authenticated/);
  const statements = splitSql(sql);
  const block = statements.find((statement) => statement.includes("$sponsor_engine_rls$"));
  assert.ok(block);
  assert.equal(block?.split("$sponsor_engine_rls$").length, 3);
  assert.equal(statements.filter((statement) => statement.includes("ENABLE ROW LEVEL SECURITY")).length, TABLES.length);
});

test("splitSql keeps quotes and dollar quotes together", () => {
  const statements = splitSql(`
    -- a note with a semicolon;
    SELECT ';';
    DO $sponsor_engine_rls$
    BEGIN
      PERFORM 1;
    END
    $sponsor_engine_rls$;
  `);
  assert.equal(statements.length, 2);
  assert.match(statements[0], /SELECT ';'/);
  assert.match(statements[1], /PERFORM 1;/);
});

test("demo mode uses sqlite in the temp directory even when DATABASE_URL is set", () => {
  const previous = {
    DEMO_MODE: process.env.DEMO_MODE,
    DATABASE_URL: process.env.DATABASE_URL,
    SPONSOR_ENGINE_DB: process.env.SPONSOR_ENGINE_DB,
  };
  process.env.DEMO_MODE = "true";
  process.env.DATABASE_URL = "postgresql://postgres.example:pw@aws-0-eu-west-2.pooler.supabase.com:6543/postgres";
  delete process.env.SPONSOR_ENGINE_DB;
  assert.equal(dbDriver(), "sqlite");
  assert.equal(defaultDbPath(), path.join(os.tmpdir(), "sponsor-engine.db"));
  if (previous.DEMO_MODE === undefined) delete process.env.DEMO_MODE;
  else process.env.DEMO_MODE = previous.DEMO_MODE;
  if (previous.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previous.DATABASE_URL;
  if (previous.SPONSOR_ENGINE_DB === undefined) delete process.env.SPONSOR_ENGINE_DB;
  else process.env.SPONSOR_ENGINE_DB = previous.SPONSOR_ENGINE_DB;
});

test("seed can run twice and keeps messages", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "sponsor-seed-"));
  const db = openDb(path.join(dir, "test.db"));
  const first = seed(db);
  const second = seed(db);
  assert.deepEqual(second.counts, first.counts);
  assert.ok(first.counts.sponsors > 0);
  assert.ok(first.counts.sponsor_claims > 0);
  assert.ok(first.counts.bookings > 0);
  db.run(
    "INSERT INTO requests (id, raw_message, status, created_at) VALUES (?, ?, ?, ?)",
    ["req_keep", "Keep this message.", "new", "2026-10-22T00:00:00.000Z"],
  );
  seed(db);
  const kept = db.get<{ id: string }>("SELECT id FROM requests WHERE id = ?", ["req_keep"]);
  assert.equal(kept?.id, "req_keep");
  assert.equal(count(db, "sponsors"), first.counts.sponsors);
  assert.equal(count(db, "sponsor_claims"), first.counts.sponsor_claims);
  assert.equal(count(db, "requests"), 1);
  db.close();
});

function count(db: ReturnType<typeof openDb>, table: string): number {
  return db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`)?.n ?? 0;
}
