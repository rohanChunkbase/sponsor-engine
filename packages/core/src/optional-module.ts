import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { repoRoot } from "@sponsor-engine/db";

const nativeImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<Record<string, unknown>>;

const cache = new Map<string, Record<string, unknown> | null>();

/** Load an optional workspace package. Missing packages return null. */
export async function loadOptionalPackage(folder: string): Promise<Record<string, unknown> | null> {
  if (cache.has(folder)) return cache.get(folder) ?? null;
  const root = repoRoot();
  const base = path.join(root, "packages", folder);
  const specs: string[] = [];
  const manifestPath = path.join(base, "package.json");
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { name?: string };
      if (manifest.name) specs.push(manifest.name);
    } catch {
      /* ignore a broken manifest */
    }
  }
  for (const relative of ["dist/index.js", "src/index.ts", "src/index.js"]) {
    const file = path.join(base, relative);
    if (fs.existsSync(file)) specs.push(pathToFileURL(file).href);
  }
  for (const specifier of specs) {
    try {
      const loaded = await nativeImport(specifier);
      const moduleRecord = unwrap(loaded);
      cache.set(folder, moduleRecord);
      return moduleRecord;
    } catch {
      continue;
    }
  }
  cache.set(folder, null);
  return null;
}

export function findFunction(
  moduleRecord: Record<string, unknown> | null,
  names: string[],
): ((...args: unknown[]) => unknown) | null {
  if (!moduleRecord) return null;
  const found = walk(moduleRecord, names, 0);
  return found;
}

function walk(value: unknown, names: string[], depth: number): ((...args: unknown[]) => unknown) | null {
  if (!value || depth > 2) return null;
  if (typeof value === "function") return null;
  if (typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  for (const name of names) {
    const candidate = record[name];
    if (typeof candidate === "function") return candidate as (...args: unknown[]) => unknown;
  }
  for (const child of Object.values(record)) {
    if (!child || typeof child !== "object" || child === record) continue;
    const found = walk(child, names, depth + 1);
    if (found) return found;
  }
  return null;
}

function unwrap(loaded: Record<string, unknown>): Record<string, unknown> {
  const defaultExport = loaded.default;
  if (defaultExport && typeof defaultExport === "object") {
    return { ...loaded, ...(defaultExport as Record<string, unknown>) };
  }
  return loaded;
}
