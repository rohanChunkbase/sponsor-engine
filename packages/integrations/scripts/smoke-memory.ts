import { createRegistry } from "../src/index.ts";
import { baseEnv } from "./smoke-env.ts";

const real = createRegistry();
console.log("Memory connections");
for (const row of real.getStatus().filter((item) => item.slot === "memory")) {
  console.log(
    `- ${row.name}: connected=${row.connected} active=${row.active} missing=${row.missing.join(",") || "none"}`,
  );
}

const registry = createRegistry(baseEnv());
const result = await registry.memory.recall("C01", "which sponsors backed my food before");
console.log(
  JSON.stringify(
    {
      script: "smoke-memory",
      mode: result.mode,
      provider: result.provider,
      hits: result.data.length,
      top: result.data[0]?.title ?? null,
      warning: result.warning ?? null,
    },
    null,
    2,
  ),
);
if (!result.ok || result.data.length === 0) process.exit(1);
