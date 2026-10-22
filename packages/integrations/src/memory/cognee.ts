import { API_USER_AGENT, politeInterval, requestText } from "../http.ts";
import { envValue } from "../options.ts";
import type { ResolvedOptions } from "../options.ts";
import { errorText, liveResult } from "../result.ts";
import type { RecallHit } from "../types.ts";
import { canonicalOrganiser, normaliseDocs } from "./corpus.ts";
import type { MemoryProvider } from "./types.ts";

function cogneeUrl(env: Record<string, string | undefined>): string | undefined {
  return envValue(env, "COGNEE_URL", "COGNEE_BASE_URL");
}

export function cogneeConfigured(env: Record<string, string | undefined>): boolean {
  return envValue(env, "COGNEE_API_KEY") !== undefined && cogneeUrl(env) !== undefined;
}

export function cogneeMissing(env: Record<string, string | undefined>): string[] {
  const missing: string[] = [];
  if (envValue(env, "COGNEE_API_KEY") === undefined) missing.push("COGNEE_API_KEY");
  if (cogneeUrl(env) === undefined) missing.push("COGNEE_URL");
  return missing;
}

const ADD_SEARCH_TIMEOUT_MS = 30_000;

function datasetName(organiserId: string): string {
  return `sponsor-engine-${canonicalOrganiser(organiserId).replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function headers(env: Record<string, string | undefined>, json: boolean): Record<string, string> {
  const key = envValue(env, "COGNEE_API_KEY") ?? "";
  const base = cogneeUrl(env) ?? "";
  const cloud = base.includes("cognee.ai");
  const result: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": API_USER_AGENT,
  };
  if (cloud) result["X-Api-Key"] = key;
  else result.Authorization = `Bearer ${key}`;
  const tenant = envValue(env, "COGNEE_TENANT_ID");
  if (tenant) result["X-Tenant-Id"] = tenant;
  if (json) result["Content-Type"] = "application/json";
  return result;
}

function hitsFromSearch(organiserId: string, body: unknown): RecallHit[] {
  const rows = Array.isArray(body) ? body : body && typeof body === "object" ? [body] : [];
  const hits: RecallHit[] = [];
  for (const row of rows) {
    if (typeof row === "string") {
      pushHit(hits, organiserId, row, "cognee");
      continue;
    }
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    const source = textValue(record.dataset_name) ?? "cognee";
    const items = Array.isArray(record.search_result) ? record.search_result : [record.search_result ?? record];
    for (const item of items) pushHit(hits, organiserId, itemText(item), source);
  }
  return hits;
}

function pushHit(hits: RecallHit[], organiserId: string, text: string | null, source: string): void {
  if (!text) return;
  hits.push({
    organiserId,
    title: `Cognee ${hits.length + 1}`,
    text: text.slice(0, 700),
    score: Math.max(1, 20 - hits.length),
    source,
    kind: "memory",
  });
}

function itemText(item: unknown): string | null {
  if (typeof item === "string") return textValue(item);
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  return textValue(record.text) ?? textValue(record.answer) ?? textValue(record.content);
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

class CogneeHttpError extends Error {
  readonly status: number;

  constructor(status: number, text: string, key: string) {
    const detail = redact(readDetail(text), key);
    super(detail ? `Cognee HTTP ${status}: ${detail}` : `Cognee HTTP ${status}`);
    this.name = "CogneeHttpError";
    this.status = status;
  }
}

function isMissingDataset(error: unknown): boolean {
  return error instanceof CogneeHttpError && (error.status === 404 || /DatasetNotFoundError/i.test(error.message));
}

function readDetail(text: string): string {
  try {
    return detailText(JSON.parse(text) as unknown);
  } catch {
    return text.trim().slice(0, 240);
  }
}

function detailText(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const detail = (body as { detail?: unknown }).detail ?? (body as { error?: unknown }).error;
  if (typeof detail === "string") return detail.trim();
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object" && typeof (item as { msg?: unknown }).msg === "string") {
          return (item as { msg: string }).msg.trim();
        }
        return "";
      })
      .filter(Boolean)
      .join("; ");
  }
  if (typeof detail === "object" && detail) {
    const row = detail as Record<string, unknown>;
    const parts = [row.message, row.error, row.msg].filter((part): part is string => typeof part === "string" && part.trim() !== "");
    return parts.join(": ");
  }
  return "";
}

function redact(text: string, key: string): string {
  if (!key || !text.includes(key)) return text;
  return text.split(key).join("[redacted]");
}

export function createCogneeMemory(options: ResolvedOptions, local: MemoryProvider): MemoryProvider {
  const base = (cogneeUrl(options.env) ?? "").replace(/\/$/, "");

  async function post(
    path: string,
    body: string | FormData,
    json: boolean,
    timeoutMs = ADD_SEARCH_TIMEOUT_MS,
  ): Promise<unknown> {
    const response = await requestText({
      url: `${base}${path}`,
      method: "POST",
      headers: headers(options.env, json),
      body,
      timeoutMs,
      fetchImpl: options.fetchImpl,
      lane: "cognee",
      minIntervalMs: politeInterval(options.fetchImpl, 250),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new CogneeHttpError(response.status, response.text, envValue(options.env, "COGNEE_API_KEY") ?? "");
    }
    try {
      return JSON.parse(response.text) as unknown;
    } catch {
      return response.text;
    }
  }

  return {
    id: "cognee",
    label: "Cognee",
    slot: "memory",
    implemented: true,
    requiredEnv: ["COGNEE_API_KEY", "COGNEE_URL"],
    isAvailable: cogneeConfigured,
    missingEnv: cogneeMissing,
    async remember(organiserId, docs) {
      const normalised = normaliseDocs(organiserId, docs);
      const localReceipt = await local.remember(organiserId, docs);
      if (!cogneeConfigured(options.env)) {
        const missing = cogneeMissing(options.env);
        return {
          ...localReceipt,
          warning:
            localReceipt.warning ??
            `Set ${missing.join(" and ")} to connect Cognee. Built-in memory stored the documents.`,
        };
      }
      if (normalised.length === 0) return localReceipt;
      const dataset = datasetName(organiserId);
      try {
        const form = new FormData();
        form.set("datasetName", dataset);
        for (const doc of normalised) {
          form.append("raw_data", `${doc.title}\n${doc.text}`);
        }
        await post("/api/v1/add", form, false);
        try {
          await post("/api/v1/cognify", JSON.stringify({ datasets: [dataset] }), true);
        } catch (error) {
          return liveResult(
            "cognee",
            { organiserId: canonicalOrganiser(organiserId), stored: normalised.length, dataset },
            {
              warning: `Cognee stored the documents. Cognify did not finish (${errorText(error)}). Built-in memory also has a copy.`,
            },
          );
        }
        return liveResult("cognee", {
          organiserId: canonicalOrganiser(organiserId),
          stored: normalised.length,
          dataset,
        });
      } catch (error) {
        return {
          ...localReceipt,
          warning: `Cognee did not accept the documents (${errorText(error)}). Built-in memory stored them.`,
        };
      }
    },
    async recall(organiserId, query) {
      if (!cogneeConfigured(options.env)) {
        const saved = await local.recall(organiserId, query);
        const missing = cogneeMissing(options.env);
        return {
          ...saved,
          warning: saved.warning ?? `Set ${missing.join(" and ")} to connect Cognee. Built-in memory answered.`,
        };
      }
      const dataset = datasetName(organiserId);
      try {
        const body = await post(
          "/api/v1/search",
          JSON.stringify({
            query,
            datasets: [dataset],
            search_type: "GRAPH_COMPLETION",
          }),
          true,
        );
        const hits = hitsFromSearch(canonicalOrganiser(organiserId), body);
        if (hits.length === 0) {
          const saved = await local.recall(organiserId, query);
          return {
            ...saved,
            warning: "Cognee returned no rows. Built-in memory answered.",
          };
        }
        return liveResult("cognee", hits);
      } catch (error) {
        const saved = await local.recall(organiserId, query);
        if (isMissingDataset(error)) {
          return { ...saved, warning: "No Cognee memory yet. Built-in memory answered." };
        }
        return {
          ...saved,
          warning: `Cognee did not answer (${errorText(error)}). Built-in memory answered.`,
        };
      }
    },
  };
}
