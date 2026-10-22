import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RegistryOptions } from "../src/options.ts";

export function tempDataDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sponsor-integrations-"));
}

export function baseOptions(extra: RegistryOptions = {}): RegistryOptions {
  return {
    env: {},
    dataDir: tempDataDir(),
    cacheTtlMs: 0,
    fetchImpl: async () => {
      throw new Error("unit test blocked the network");
    },
    ...extra,
  };
}

export function header(init: RequestInit | undefined, name: string): string | null {
  const headers = init?.headers;
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  if (Array.isArray(headers)) {
    const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return found ? String(found[1]) : null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? record[key] : null;
}
