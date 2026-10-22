import path from "node:path";
import { BROWSER_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import { builtinResult, errorText, liveResult } from "../result.ts";
import type { ProviderResult } from "../types.ts";

export interface DevpostProject {
  name: string;
  url: string | null;
  tagline: string | null;
  winner: boolean;
  likeCount: number | null;
  members: string[];
  tags: string[];
}

export function parseDevpostProjects(payload: unknown): DevpostProject[] {
  const root = payload && typeof payload === "object" ? (payload as { software?: unknown }) : {};
  const rows = Array.isArray(root.software) ? root.software : [];
  const projects: DevpostProject[] = [];
  for (const item of rows) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = text(row.name);
    if (!name) continue;
    projects.push({
      name,
      url: text(row.url),
      tagline: text(row.tagline),
      winner: row.winner === true,
      likeCount: num(row.like_count),
      members: Array.isArray(row.members) ? row.members.filter((member): member is string => typeof member === "string") : [],
      tags: Array.isArray(row.tags) ? row.tags.filter((tag): tag is string => typeof tag === "string") : [],
    });
  }
  return projects;
}

export async function devpostProjects(
  query: string,
  options: ResolvedOptions,
): Promise<ProviderResult<DevpostProject[]>> {
  const needle = query.trim();
  if (!needle) return builtinResult("bundled-data", [], "A search query is required.");
  if (options.offline) return builtinResult("bundled-data", [], "Live calls are off. Devpost project search was skipped.");
  try {
    const url = `https://devpost.com/software/search?query=${encodeURIComponent(needle)}`;
    const response = await requestText({
      url,
      headers: { Accept: "application/json", "User-Agent": BROWSER_USER_AGENT },
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      lane: "devpost-projects",
      minIntervalMs: politeInterval(options.fetchImpl, 1500),
      cacheDir: path.join(options.dataDir, "cache", "devpost-projects"),
      cacheTtlMs: options.cacheTtlMs,
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`Devpost HTTP ${response.status}`);
    return liveResult("devpost-projects", parseDevpostProjects(parseJson(response.text)), { cached: response.fromCache });
  } catch (error) {
    return builtinResult("bundled-data", [], `Devpost project search did not respond (${errorText(error)}).`);
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
