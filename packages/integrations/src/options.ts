import path from "node:path";
import { fileURLToPath } from "node:url";

export interface RegistryOptions {
  /** Env map. When omitted, the process env is used. An empty object hides the process env. */
  env?: Record<string, string | undefined>;
  /** Folder for crm_export.json, memory files, and the HTTP cache. */
  dataDir?: string;
  /** Folder that holds real-data/ and synthetic-data/. */
  seedDir?: string;
  fetchImpl?: typeof fetch;
  /** Per-request timeout for live data calls. Default 4000 ms. */
  timeoutMs?: number;
  /** Cache lifetime for live GET calls. 0 disables the cache. Default 12 hours. */
  cacheTtlMs?: number;
  /** When true, data calls skip the network and use the bundled data. */
  offline?: boolean;
  /**
   * Force a CRM id ("local-crm", "zero", "twenty", "hubspot", "notion", "google-sheets").
   * A stub, or a provider with a missing key, leaves the built-in CRM active.
   */
  crm?: string;
  /** Force a memory id ("local-memory", "cognee", "mem0"). */
  memory?: string;
  /** "live" tries the network, then the bundle. "bundled" skips the network. */
  data?: "live" | "bundled";
}

export interface ResolvedOptions {
  env: Record<string, string | undefined>;
  dataDir: string;
  seedDir: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  cacheTtlMs: number;
  offline: boolean;
  crm?: string;
  memory?: string;
  data: "live" | "bundled";
}

const here = path.dirname(fileURLToPath(import.meta.url));

/** Folder that contains package.json. Works for src/ and for dist/. */
export const packageRoot = path.resolve(here, "..");

export const defaultSeedDir = path.join(packageRoot, "seed");
export const defaultDataDir = path.join(packageRoot, ".data");

export function envValue(
  env: Record<string, string | undefined>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === "string" && value.trim() !== "") return value.trim();
  }
  return undefined;
}

export function missingEnv(
  env: Record<string, string | undefined>,
  keys: readonly string[],
): string[] {
  return keys.filter((key) => envValue(env, key) === undefined);
}

export function resolveOptions(options: RegistryOptions = {}): ResolvedOptions {
  const env = options.env ?? process.env;
  const offlineFlag = envValue(env, "SPONSOR_ENGINE_OFFLINE") === "1";
  const data =
    options.data ??
    (options.offline || offlineFlag ? "bundled" : "live");
  return {
    env,
    dataDir:
      options.dataDir ??
      envValue(env, "SPONSOR_ENGINE_DATA_DIR") ??
      defaultDataDir,
    seedDir: options.seedDir ?? envValue(env, "SEED_DATA_DIR") ?? defaultSeedDir,
    fetchImpl: options.fetchImpl ?? fetch,
    timeoutMs: options.timeoutMs ?? 4000,
    cacheTtlMs: options.cacheTtlMs ?? 12 * 60 * 60 * 1000,
    offline: (options.offline ?? offlineFlag) || data === "bundled",
    crm: options.crm,
    memory: options.memory,
    data,
  };
}

export function safeFilePart(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.slice(0, 80) || "default";
}
