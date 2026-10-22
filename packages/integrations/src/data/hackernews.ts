import path from "node:path";
import { API_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import { builtinResult, errorText, liveResult } from "../result.ts";
import type { ProviderResult } from "../types.ts";

export interface HackerNewsStory {
  title: string;
  url: string | null;
  points: number | null;
  comments: number | null;
  createdAt: string | null;
  author: string | null;
}

export function parseHackerNews(payload: unknown): HackerNewsStory[] {
  const root = payload && typeof payload === "object" ? (payload as { hits?: unknown }) : {};
  const hits = Array.isArray(root.hits) ? root.hits : [];
  const stories: HackerNewsStory[] = [];
  for (const item of hits) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const title = text(row.title);
    if (!title) continue;
    stories.push({
      title,
      url: text(row.url),
      points: num(row.points),
      comments: num(row.num_comments),
      createdAt: text(row.created_at),
      author: text(row.author),
    });
  }
  return stories;
}

export async function hackerNewsStories(
  handle: string,
  options: ResolvedOptions,
): Promise<ProviderResult<HackerNewsStory[]>> {
  const name = handle.trim().replace(/^@/, "");
  if (!name) return builtinResult("bundled-data", [], "A Hacker News handle is required.");
  if (options.offline) return builtinResult("bundled-data", [], "Live calls are off. Hacker News search was skipped.");
  try {
    const url =
      `https://hn.algolia.com/api/v1/search_by_date?tags=story,author_${encodeURIComponent(name)}&hitsPerPage=5`;
    const response = await requestText({
      url,
      headers: { Accept: "application/json", "User-Agent": API_USER_AGENT },
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      lane: "hacker-news",
      minIntervalMs: politeInterval(options.fetchImpl, 500),
      cacheDir: path.join(options.dataDir, "cache", "hacker-news"),
      cacheTtlMs: options.cacheTtlMs,
    });
    if (response.status < 200 || response.status >= 300) throw new Error(`Hacker News HTTP ${response.status}`);
    return liveResult("hacker-news", parseHackerNews(parseJson(response.text)), { cached: response.fromCache });
  } catch (error) {
    return builtinResult("bundled-data", [], `Hacker News did not respond (${errorText(error)}).`);
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
