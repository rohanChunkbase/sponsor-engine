import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { repoRoot } from "@sponsor-engine/db";
import { getReadyDb } from "@sponsor-engine/core";

const rootForBuild = repoRoot();
if (!existsSync(join(rootForBuild, "packages/pricing/dist/index.js"))) {
  const built = spawnSync("npm", ["run", "build", "-w", "@sponsor-engine/pricing"], {
    cwd: rootForBuild,
    stdio: "inherit",
  });
  if (built.status !== 0) process.exit(built.status ?? 1);
}

getReadyDb();
const root = repoRoot();
console.log("Sponsor Engine is ready.");
console.log("Test mode is on. Nothing is sent.");
console.log("Open http://localhost:3000");

const child = spawn("npm", ["run", "dev", "-w", "@sponsor-engine/web"], {
  cwd: root,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
