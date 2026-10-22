import type { ProviderResult } from "./types.ts";

export function builtinResult<T>(
  provider: string,
  data: T,
  warning?: string,
): ProviderResult<T> {
  return warning
    ? { ok: true, mode: "builtin", provider, data, warning }
    : { ok: true, mode: "builtin", provider, data };
}

export function liveResult<T>(
  provider: string,
  data: T,
  extra?: { warning?: string; cached?: boolean },
): ProviderResult<T> {
  const result: ProviderResult<T> = {
    ok: true,
    mode: "live",
    provider,
    data,
  };
  if (extra?.warning) result.warning = extra.warning;
  if (extra?.cached) result.cached = true;
  return result;
}

export function errorText(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "request failed";
}
