import type { PricingHistoryRow, PricingQuote, PricingRequest } from "./types.js";
import { findFunction, loadOptionalPackage } from "./optional-module.js";

/** Call packages/pricing quotePrice when that package exists. */
export async function quoteFromPricingModule(
  request: PricingRequest,
  history: PricingHistoryRow[],
): Promise<PricingQuote | null> {
  const fn = findFunction(await loadOptionalPackage("pricing"), ["quotePrice"]);
  if (!fn) return null;
  try {
    const result = (await fn(request, history)) as Partial<PricingQuote> | null;
    if (!result || typeof result.price !== "number" || !Number.isFinite(result.price)) return null;
    if (typeof result.explanation !== "string" || !result.explanation.trim()) return null;
    return {
      price: Math.round(result.price),
      currency: result.currency || "GBP",
      explanation: result.explanation.trim(),
      comparables: Array.isArray(result.comparables) ? result.comparables : [],
    };
  } catch {
    return null;
  }
}
