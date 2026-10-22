import { envValue } from "../options.ts";
import type { MemoryProvider } from "./types.ts";

/**
 * Stub. Mem0 is not called.
 * A future adapter should store one memory per organiser and search it by text.
 * Env: MEM0_API_KEY.
 */
export function createMem0Memory(local: MemoryProvider): MemoryProvider {
  return {
    id: "mem0",
    label: "Mem0",
    slot: "memory",
    implemented: false,
    requiredEnv: ["MEM0_API_KEY"],
    isAvailable: () => false,
    missingEnv(env) {
      return envValue(env, "MEM0_API_KEY") ? [] : ["MEM0_API_KEY"];
    },
    async remember(organiserId, docs) {
      const saved = await local.remember(organiserId, docs);
      return {
        ...saved,
        warning: join(saved.warning, "Mem0 is a stub. Built-in memory stored the documents."),
      };
    },
    async recall(organiserId, query) {
      const saved = await local.recall(organiserId, query);
      return {
        ...saved,
        warning: join(saved.warning, "Mem0 is a stub. Built-in memory answered."),
      };
    },
  };
}

function join(current: string | undefined, extra: string): string {
  return current ? `${current} ${extra}` : extra;
}
