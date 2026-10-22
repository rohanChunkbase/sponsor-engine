import path from "node:path";
import { BROWSER_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import { errorText, liveResult } from "../result.ts";
import type { DevpostHackathon, ProviderResult } from "../types.ts";
import { parseDevpostPayload } from "./parse.ts";
import type { DataSource } from "./types.ts";

const STATUSES = ["upcoming", "open", "ended"] as const;

function pageUrl(status: string): string {
  return `https://devpost.com/api/hackathons?status[]=${encodeURIComponent(status)}&search=london`;
}

export async function devpostLondonHackathons(
  options: ResolvedOptions,
  bundled: DataSource,
): Promise<ProviderResult<DevpostHackathon[]>> {
  if (options.offline) return bundled.devpostLondonHackathons();
  const merged = new Map<string, DevpostHackathon>();
  let cached = true;
  let success = 0;
  let lastError = "no response";
  for (const status of STATUSES) {
    try {
      const response = await requestText({
        url: pageUrl(status),
        headers: {
          Accept: "application/json",
          "User-Agent": BROWSER_USER_AGENT,
        },
        timeoutMs: options.timeoutMs,
        fetchImpl: options.fetchImpl,
        lane: "devpost",
        minIntervalMs: politeInterval(options.fetchImpl, 1500),
        cacheDir: path.join(options.dataDir, "cache", "devpost"),
        cacheTtlMs: options.cacheTtlMs,
      });
      if (response.status < 200 || response.status >= 300) {
        throw new Error(`Devpost HTTP ${response.status}`);
      }
      success += 1;
      cached = cached && response.fromCache;
      for (const row of parseDevpostPayload(parseJson(response.text))) {
        merged.set(row.id ?? row.url ?? row.title, row);
      }
    } catch (error) {
      lastError = errorText(error);
    }
  }
  if (success === 0) {
    const fallback = await bundled.devpostLondonHackathons();
    return {
      ...fallback,
      warning: `Devpost did not respond (${lastError}). Bundled data was used.`,
    };
  }
  return liveResult("devpost", [...merged.values()], { cached: cached && success > 0 });
}
