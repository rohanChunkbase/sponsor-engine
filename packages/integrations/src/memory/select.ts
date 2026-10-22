import type { ResolvedOptions } from "../options.ts";
import { createCogneeMemory } from "./cognee.ts";
import { createLocalMemory } from "./local.ts";
import { createMem0Memory } from "./mem0.ts";
import type { MemoryProvider } from "./types.ts";

export interface MemorySelection {
  active: MemoryProvider;
  catalog: MemoryProvider[];
}

export function selectMemory(options: ResolvedOptions): MemorySelection {
  const local = createLocalMemory(options);
  const catalog = [local, createCogneeMemory(options, local), createMem0Memory(local)];
  const forced = options.memory
    ? catalog.find((provider) => provider.id === options.memory)
    : undefined;
  if (forced?.implemented && forced.isAvailable(options.env)) {
    return { active: forced, catalog };
  }
  const cognee = catalog.find((provider) => provider.id === "cognee");
  if (cognee?.implemented && cognee.isAvailable(options.env) && options.memory !== "local-memory") {
    return { active: cognee, catalog };
  }
  return { active: local, catalog };
}
