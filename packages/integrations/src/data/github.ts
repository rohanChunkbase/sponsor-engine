import path from "node:path";
import { API_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import { envValue, type ResolvedOptions } from "../options.ts";
import { builtinResult, errorText, liveResult } from "../result.ts";
import type { ProviderResult } from "../types.ts";

export interface GithubProfile {
  handle: string;
  found: boolean;
  createdAt: string | null;
  publicRepos: number | null;
  followers: number | null;
  accountAgeDays: number | null;
}

export function parseGithubUser(handle: string, payload: unknown, now = Date.now()): GithubProfile {
  const row = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const createdAt = typeof row.created_at === "string" ? row.created_at : null;
  const createdMs = createdAt ? Date.parse(createdAt) : Number.NaN;
  const accountAgeDays = Number.isFinite(createdMs) ? Math.max(0, Math.floor((now - createdMs) / 86_400_000)) : null;
  return {
    handle,
    found: true,
    createdAt,
    publicRepos: num(row.public_repos),
    followers: num(row.followers),
    accountAgeDays,
  };
}

export function emptyGithubProfile(handle: string): GithubProfile {
  return { handle, found: false, createdAt: null, publicRepos: null, followers: null, accountAgeDays: null };
}

export function githubTokenSet(env: Record<string, string | undefined>): boolean {
  return envValue(env, "GITHUB_TOKEN") !== undefined;
}

export async function githubProfile(
  handle: string,
  options: ResolvedOptions,
): Promise<ProviderResult<GithubProfile>> {
  const name = handle.trim().replace(/^@/, "");
  if (!name) return builtinResult("bundled-data", emptyGithubProfile(handle), "A GitHub handle is required.");
  if (options.offline) {
    return builtinResult("bundled-data", emptyGithubProfile(name), "Live calls are off. The GitHub profile was skipped.");
  }
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "User-Agent": API_USER_AGENT,
    };
    const token = envValue(options.env, "GITHUB_TOKEN");
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await requestText({
      url: `https://api.github.com/users/${encodeURIComponent(name)}`,
      headers,
      timeoutMs: options.timeoutMs,
      fetchImpl: options.fetchImpl,
      lane: "github",
      minIntervalMs: politeInterval(options.fetchImpl, 1200),
      cacheDir: path.join(options.dataDir, "cache", "github"),
      cacheTtlMs: options.cacheTtlMs,
    });
    if (response.status === 404) return liveResult("github", emptyGithubProfile(name));
    if (response.status < 200 || response.status >= 300) throw new Error(`GitHub HTTP ${response.status}`);
    return liveResult("github", parseGithubUser(name, parseJson(response.text)), { cached: response.fromCache });
  } catch (error) {
    return builtinResult(
      "bundled-data",
      emptyGithubProfile(name),
      `GitHub did not respond (${errorText(error)}).`,
    );
  }
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
