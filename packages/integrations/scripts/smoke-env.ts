import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { RegistryOptions } from "../src/options.ts";

/** Smoke CRM and memory calls stay on the built-in providers. Live data has its own script. */
export function baseEnv(): RegistryOptions {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "sponsor-smoke-"));
  return {
    env: {},
    dataDir,
    fetchImpl: async () => {
      throw new Error("smoke crm/memory does not call the network");
    },
  };
}
