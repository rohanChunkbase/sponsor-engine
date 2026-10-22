import { cardSpecFor } from "./announce.js";
import { getRecap } from "./example.js";
import type { CardFormat, CardKind, CardSpec } from "./types.js";

const KINDS = new Set<CardKind>(["winner", "sponsors", "summary"]);
const FORMATS = new Set<CardFormat>(["landscape", "portrait"]);

export function cardSpecFromSearchParams(params: URLSearchParams): CardSpec | undefined {
  const slug = params.get("slug")?.trim() ?? "";
  const kind = params.get("kind")?.trim() ?? "";
  const formatValue = params.get("format")?.trim() || "landscape";
  if (!KINDS.has(kind as CardKind) || !FORMATS.has(formatValue as CardFormat)) return undefined;
  const recap = getRecap(slug);
  if (!recap) return undefined;
  const index = Number(params.get("index") ?? "0");
  if (!Number.isInteger(index) || index < 0) return undefined;
  return cardSpecFor(recap, kind as CardKind, index, formatValue as CardFormat);
}
