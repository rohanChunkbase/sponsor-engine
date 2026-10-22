import type { MemoryDoc, ProviderResult, RecallHit, RememberReceipt } from "../types.ts";

/** Memory provider. Bring your own memory, or use the built-in keyword search. */
export interface MemoryProvider {
  readonly id: string;
  readonly label: string;
  readonly slot: "memory";
  readonly implemented: boolean;
  readonly requiredEnv: readonly string[];
  isAvailable(env: Record<string, string | undefined>): boolean;
  missingEnv(env: Record<string, string | undefined>): string[];
  remember(
    organiserId: string,
    docs: Array<string | MemoryDoc>,
  ): Promise<ProviderResult<RememberReceipt>>;
  recall(organiserId: string, query: string): Promise<ProviderResult<RecallHit[]>>;
}
