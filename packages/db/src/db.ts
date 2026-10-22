import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { openPostgres } from "./postgres.js";

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

export function repoRoot(): string {
  if (process.env.SPONSOR_ENGINE_ROOT) return process.env.SPONSOR_ENGINE_ROOT;
  let dir = process.cwd();
  for (let i = 0; i < 6; i++) {
    const pkg = path.join(dir, "package.json");
    if (fs.existsSync(pkg)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(pkg, "utf8")) as { name?: string };
        if (parsed.name === "sponsor-engine") return dir;
      } catch {
        /* keep walking */
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.resolve(here, "../../..");
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
  const schema = fs.readFileSync(path.join(here, "schema.sql"), "utf8");
  sqlite.exec(schema);
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

function wrap(sqlite: Database.Database): Db {
  return {
    kind: "sqlite",
    exec(sql) {
      sqlite.exec(sql);
    },
    all<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(sql).all(...(params as never[])) as T[];
    },
    get<T>(sql: string, params: unknown[] = []) {
      return sqlite.prepare(sql).get(...(params as never[])) as T | undefined;
    },
    run(sql: string, params: unknown[] = []) {
      const info = sqlite.prepare(sql).run(...(params as never[]));
      return { changes: info.changes };
    },
    close() {
      sqlite.close();
    },
  };
}
