import fs from "node:fs";
import path from "node:path";
import { repoRoot } from "@sponsor-engine/db";

let loaded = false;

/** Load the root .env file when a variable is empty. Existing variables stay. */
export function loadEnv(): void {
  if (loaded) return;
  loaded = true;
  const file = path.join(repoRoot(), ".env");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}
