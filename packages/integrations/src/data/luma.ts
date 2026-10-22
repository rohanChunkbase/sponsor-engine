import path from "node:path";
import { API_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import type { ResolvedOptions } from "../options.ts";
import { errorText, liveResult } from "../result.ts";
import type { LumaEventHosts, ProviderResult } from "../types.ts";
import { lookupLuma } from "./bundled.ts";
import { parseLumaPayload } from "./parse.ts";
import type { DataSource } from "./types.ts";

const EVENT_GET = "https://api.lu.ma/event/get";

export function lumaApiIdFromHtml(html: string): string | null {
  const match = html.match(/evt-[A-Za-z0-9]+/);
  return match ? match[0] : null;
}

async function resolveApiId(input: string, options: ResolvedOptions): Promise<string | null> {
  const trimmed = input.trim();
  if (trimmed.startsWith("evt-")) return trimmed;
  let pageUrl = trimmed;
  if (!trimmed.startsWith("http")) pageUrl = `https://lu.ma/${trimmed.replace(/^\/+/, "")}`;
  const response = await requestText({
    url: pageUrl,
    headers: { Accept: "text/html", "User-Agent": API_USER_AGENT },
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "luma",
    minIntervalMs: politeInterval(options.fetchImpl, 2000),
    cacheDir: path.join(options.dataDir, "cache", "luma"),
    cacheTtlMs: options.cacheTtlMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Luma page HTTP ${response.status}`);
  }
  return lumaApiIdFromHtml(response.text);
}

export async function fetchLumaHosts(
  eventUrlOrId: string,
  options: ResolvedOptions,
): Promise<{ data: LumaEventHosts; cached: boolean }> {
  const apiId = await resolveApiId(eventUrlOrId, options);
  if (!apiId) throw new Error("Luma event id was not found");
  const url = `${EVENT_GET}?event_api_id=${encodeURIComponent(apiId)}`;
  const response = await requestText({
    url,
    headers: { Accept: "application/json", "User-Agent": API_USER_AGENT },
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "luma",
    minIntervalMs: politeInterval(options.fetchImpl, 2000),
    cacheDir: path.join(options.dataDir, "cache", "luma"),
    cacheTtlMs: options.cacheTtlMs,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Luma HTTP ${response.status}`);
  }
  const data = parseLumaPayload(parseJson(response.text), eventUrlOrId);
  data.eventId = data.eventId ?? apiId;
  return { data, cached: response.fromCache };
}

export async function lumaEventHosts(
  eventUrlOrId: string,
  options: ResolvedOptions,
  bundled: DataSource,
): Promise<ProviderResult<LumaEventHosts>> {
  if (options.offline) return bundled.lumaEventHosts(eventUrlOrId);
  try {
    const live = await fetchLumaHosts(eventUrlOrId, options);
    const extra = lookupLuma(options.seedDir, eventUrlOrId);
    const data: LumaEventHosts = {
      ...live.data,
      name: live.data.name ?? extra.name,
      url: live.data.url ?? extra.url,
      sponsors: live.data.sponsors.length > 0 ? live.data.sponsors : extra.sponsors,
      hosts: live.data.hosts.length > 0 ? live.data.hosts : extra.hosts,
    };
    return liveResult("luma", data, { cached: live.cached });
  } catch (error) {
    const fallback = await bundled.lumaEventHosts(eventUrlOrId);
    return {
      ...fallback,
      warning: `Luma did not respond (${errorText(error)}). Bundled data was used.`,
    };
  }
}
