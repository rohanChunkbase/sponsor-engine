import { createRegistry } from "../src/index.ts";

const key = process.env.COGNEE_API_KEY?.trim();
if (!key) {
  console.log(
    JSON.stringify(
      { script: "smoke-cognee", skipped: true, reason: "COGNEE_API_KEY is not set." },
      null,
      2,
    ),
  );
  process.exit(0);
}

const registry = createRegistry();
const stored = await registry.memory.remember("test", [
  "Sponsor Engine smoke note for dataset sponsor-engine-test.",
]);
const found = await registry.memory.recall("test", "smoke note");

console.log(
  JSON.stringify(
    {
      script: "smoke-cognee",
      dataset: stored.data.dataset,
      remember: {
        mode: stored.mode,
        provider: stored.provider,
        stored: stored.data.stored,
        warning: hideUrls(stored.warning),
      },
      recall: {
        mode: found.mode,
        provider: found.provider,
        hits: found.data.length,
        source: found.data[0]?.source ?? null,
        warning: hideUrls(found.warning),
      },
    },
    null,
    2,
  ),
);

function hideUrls(warning: string | undefined): string | null {
  if (!warning) return null;
  return warning.replace(/https?:\/\/\S+/g, "[url]");
}
