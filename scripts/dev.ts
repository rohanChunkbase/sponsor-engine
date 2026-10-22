import { spawn } from "node:child_process";
import { repoRoot } from "@sponsor-engine/db";
import { getReadyDb } from "@sponsor-engine/core";

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
