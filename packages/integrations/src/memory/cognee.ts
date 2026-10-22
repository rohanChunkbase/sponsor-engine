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
  const rows = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { results?: unknown }).results)
      ? (body as { results: unknown[] }).results
      : body && typeof body === "object"
        ? [body]
        : [];
  const hits: RecallHit[] = [];
  rows.forEach((row, index) => {
    if (typeof row === "string") {
      hits.push({
        organiserId,
        title: `Cognee ${index + 1}`,
        text: row.slice(0, 700),
        score: rows.length - index,
        source: "cognee",
        kind: "memory",
      });
      return;
    }
    if (!row || typeof row !== "object") return;
    const record = row as { text?: unknown; search_result?: unknown; answer?: unknown; content?: unknown };
    const text = [record.text, record.search_result, record.answer, record.content].find(
      (value) => typeof value === "string" && value.trim() !== "",
    );
    if (typeof text !== "string") return;
    hits.push({
      organiserId,
      title: `Cognee ${index + 1}`,
      text: text.slice(0, 700),
      score: rows.length - index,
      source: "cognee",
      kind: "memory",
    });
  });
  return hits;
}

export function createCogneeMemory(options: ResolvedOptions, local: MemoryProvider): MemoryProvider {
  const base = (cogneeUrl(options.env) ?? "").replace(/\/$/, "");

  async function post(path: string, body: string | FormData, json: boolean): Promise<unknown> {
    const response = await requestText({
      url: `${base}${path}`,
      method: "POST",
      headers: headers(options.env, json),
      body,
      timeoutMs: Math.max(options.timeoutMs, 8000),
      fetchImpl: options.fetchImpl,
      lane: "cognee",
      minIntervalMs: politeInterval(options.fetchImpl, 250),
    });
    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Cognee HTTP ${response.status}`);
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
        return {
          ...saved,
          warning: `Cognee did not answer (${errorText(error)}). Built-in memory answered.`,
        };
      }
    },
  };
}
