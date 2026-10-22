import type { ResolvedOptions } from "../options.ts";
import { builtinResult } from "../result.ts";
import type { MemoryProvider } from "./types.ts";
import {
  buildCorpus,
  canonicalOrganiser,
  normaliseDocs,
  readStored,
  searchDocs,
  writeStored,
  type StoredDoc,
} from "./corpus.ts";

export function createLocalMemory(options: ResolvedOptions): MemoryProvider {
  return {
    id: "local-memory",
    label: "Built-in memory",
    slot: "memory",
    implemented: true,
    requiredEnv: [],
    isAvailable: () => true,
    missingEnv: () => [],
    async remember(organiserId, docs) {
      const normalised = normaliseDocs(organiserId, docs);
      if (normalised.length === 0) {
        return builtinResult(
          "local-memory",
          { organiserId: canonicalOrganiser(organiserId), stored: 0 },
          "No documents to store.",
        );
      }
      const existing = readStored(options.dataDir, organiserId);
      const stored: StoredDoc[] = [
        ...existing,
        ...normalised.map((doc) => ({ ...doc, at: new Date().toISOString() })),
      ];
      writeStored(options.dataDir, organiserId, stored);
      return builtinResult("local-memory", {
        organiserId: canonicalOrganiser(organiserId),
        stored: normalised.length,
      });
    },
    async recall(organiserId, query) {
      if (!query.trim()) {
        return builtinResult("local-memory", [], "The query is empty.");
      }
      const docs = [...buildCorpus(options.seedDir), ...readStored(options.dataDir, organiserId)];
      const hits = searchDocs(docs, organiserId, query);
      return builtinResult(
        "local-memory",
        hits,
        hits.length === 0 ? "No note matched the query." : undefined,
      );
    },
  };
}
