import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { openPostgres } from "./postgres.js";
import { scopeSql } from "./scope.js";

const here = path.dirname(fileURLToPath(import.meta.url));

export type Db = {
  kind: "sqlite" | "postgres";
  exec(sql: string): void;
  all<T>(sql: string, params?: unknown[]): T[];
  get<T>(sql: string, params?: unknown[]): T | undefined;
  run(sql: string, params?: unknown[]): { changes: number };
  close(): void;
};

let singleton: Db | null = null;

function isRepoRoot(dir: string): boolean {
  const pkg = path.join(dir, "package.json");
  if (!fs.existsSync(pkg)) return false;
  try {
    const parsed = JSON.parse(fs.readFileSync(pkg, "utf8")) as { name?: string };
    return parsed.name === "sponsor-engine";
  } catch {
    return false;
  }
}

function walkToRepo(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (isRepoRoot(dir)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return null;
}

export function repoRoot(): string {
  if (process.env.SPONSOR_ENGINE_ROOT) return process.env.SPONSOR_ENGINE_ROOT;
  return walkToRepo(process.cwd())
    ?? walkToRepo(path.dirname(fileURLToPath(import.meta.url)))
    ?? path.resolve(process.cwd(), "../..");
}

export function defaultDbPath(): string {
  if (process.env.SPONSOR_ENGINE_DB) return process.env.SPONSOR_ENGINE_DB;
  return path.join(repoRoot(), "data", "sponsor-engine.db");
}

export function openDb(file = defaultDbPath()): Db {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(readSchema());
  ensureWorkspaceColumns(sqlite);
  return wrap(sqlite);
}

export function databaseUrl(): string {
  return process.env.DATABASE_URL?.trim() ?? "";
}

export function usesPostgres(): boolean {
  return /^postgres(ql)?:\/\//i.test(databaseUrl());
}

export function getDb(): Db {
  if (!singleton) singleton = usesPostgres() ? openPostgres(databaseUrl()) : openDb();
  return singleton;
}

export function resetSingleton(): void {
  if (singleton) singleton.close();
  singleton = null;
}

const SCOPED_TABLES = ["requests", "tasks", "quotes", "outbox", "approvals", "agent_runs", "failures"];

function readSchema(): string {
  const beside = path.join(here, "schema.sql");
  const file = fs.existsSync(beside) ? beside : path.join(repoRoot(), "packages/db/src/schema.sql");
  return fs.readFileSync(file, "utf8");
}

function ensureWorkspaceColumns(sqlite: Database.Database): void {
  for (const table of SCOPED_TABLES) {
    const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((col) => col.name === "workspace_id")) {
      sqlite.exec(`ALTER TABLE ${table} ADD COLUMN workspace_id TEXT NOT NULL DEFAULT 'local'`);
    }
  }
  sqlite.exec(`CREATE TABLE IF NOT EXISTS venue_files (
    workspace_id TEXT PRIMARY KEY,
    csv TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_requests_workspace ON requests(workspace_id)");
  sqlite.exec("CREATE INDEX IF NOT EXISTS idx_outbox_workspace ON outbox(workspace_id)");
}

function wrap(sqlite: Database.Database): Db {
  return {
    kind: "sqlite",
    exec(sql) {
      sqlite.exec(sql);
    },
    all<T>(sql: string, params: unknown[] = []) {
      const query = scopeSql(sql, params);
      return sqlite.prepare(query.sql).all(...(query.params as never[])) as T[];
    },
    get<T>(sql: string, params: unknown[] = []) {
      const query = scopeSql(sql, params);
      return sqlite.prepare(query.sql).get(...(query.params as never[])) as T | undefined;
    },
    run(sql: string, params: unknown[] = []) {
      const query = scopeSql(sql, params);
      const info = sqlite.prepare(query.sql).run(...(query.params as never[]));
      return { changes: info.changes };
    },
    close() {
      sqlite.close();
    },
  };
}
