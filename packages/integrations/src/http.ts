import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const tails = new Map<string, Promise<void>>();
const lastAt = new Map<string, number>();

export function pace(lane: string, minIntervalMs: number): Promise<void> {
  const prev = tails.get(lane) ?? Promise.resolve();
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(lane, gate);
  return prev
    .then(async () => {
      if (minIntervalMs <= 0) return;
      const elapsed = Date.now() - (lastAt.get(lane) ?? 0);
      const wait = minIntervalMs - elapsed;
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastAt.set(lane, Date.now());
    })
    .finally(() => release());
}

export interface HttpRequest {
  url: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string | FormData;
  timeoutMs: number;
  fetchImpl: typeof fetch;
  lane: string;
  minIntervalMs: number;
  cacheDir?: string;
  cacheTtlMs?: number;
}

export interface HttpResponse {
  status: number;
  text: string;
  fromCache: boolean;
}

interface CacheEntry {
  fetchedAt: number;
  status: number;
  text: string;
}

function cacheFile(cacheDir: string, url: string): string {
  const hash = createHash("sha256").update(url).digest("hex");
  return path.join(cacheDir, `${hash}.json`);
}

function readCache(cacheDir: string, url: string, ttlMs: number): CacheEntry | undefined {
  if (ttlMs <= 0) return undefined;
  try {
    const raw = fs.readFileSync(cacheFile(cacheDir, url), "utf8");
    const parsed = JSON.parse(raw) as CacheEntry;
    if (Date.now() - parsed.fetchedAt > ttlMs) return undefined;
    if (parsed.status < 200 || parsed.status >= 300) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeCache(cacheDir: string, url: string, status: number, text: string): void {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    const entry: CacheEntry = { fetchedAt: Date.now(), status, text };
    const file = cacheFile(cacheDir, url);
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(entry));
    fs.renameSync(tmp, file);
  } catch {
    // A cache write must not break the demo.
  }
}

export async function requestText(req: HttpRequest): Promise<HttpResponse> {
  const method = req.method ?? "GET";
  if (method === "GET" && req.cacheDir) {
    const hit = readCache(req.cacheDir, req.url, req.cacheTtlMs ?? 0);
    if (hit) return { status: hit.status, text: hit.text, fromCache: true };
  }

  await pace(req.lane, req.minIntervalMs);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs);
  try {
    const response = await req.fetchImpl(req.url, {
      method,
      headers: req.headers,
      body: req.body,
      signal: controller.signal,
    });
    const text = await response.text();
    if (method === "GET" && response.ok && req.cacheDir && (req.cacheTtlMs ?? 0) > 0) {
      writeCache(req.cacheDir, req.url, response.status, text);
    }
    return { status: response.status, text, fromCache: false };
  } catch (error) {
    const aborted =
      (error instanceof Error && error.name === "AbortError") ||
      (typeof error === "object" &&
        error !== null &&
        "name" in error &&
        (error as { name: string }).name === "AbortError");
    if (aborted) {
      throw new Error(`Timeout after ${req.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export function parseJson(text: string): unknown {
  if (!text.trim()) return {};
  return JSON.parse(text);
}

/** Polite browser-like agent. Devpost rejects a bare bot agent. */
export const BROWSER_USER_AGENT =
  "Mozilla/5.0 (compatible; SponsorEngine/0.1; +https://github.com/rohanChunkbase/sponsor-engine)";

export const API_USER_AGENT =
  "SponsorEngine/0.1 (+https://github.com/rohanChunkbase/sponsor-engine)";

/** A custom fetch (unit tests) skips the wait. The real fetch stays polite. */
export function politeInterval(fetchImpl: typeof fetch, minIntervalMs: number): number {
  return fetchImpl === globalThis.fetch ? minIntervalMs : 0;
}
