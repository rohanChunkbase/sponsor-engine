import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const scripts = ["smoke-crm.ts", "smoke-memory.ts", "smoke-live.ts"];

function run(script: string): Promise<number> {
  const child = spawn(process.execPath, ["--experimental-strip-types", path.join(here, script)], {
    stdio: "inherit",
  });
  return new Promise((resolve) => child.on("exit", (code) => resolve(code ?? 1)));
}

let failed = 0;
for (const script of scripts) {
  const code = await run(script);
  if (code !== 0) failed += 1;
}
if (failed > 0) process.exit(1);
