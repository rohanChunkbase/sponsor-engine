import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, type Db } from "@sponsor-engine/db";

const here = path.dirname(fileURLToPath(import.meta.url));

export function fixture(name: string): string {
  return readFileSync(path.join(here, "../fixtures", name), "utf8");
}

export function tempDb(): Db {
  const root = mkdtempSync(path.join(tmpdir(), "channels-"));
  return openDb(path.join(root, "test.db"));
}
