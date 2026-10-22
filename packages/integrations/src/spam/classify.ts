import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { classifyText, type SpamModel, type SpamVerdict } from "./bayes.ts";

let cached: SpamModel | undefined;

export function loadSpamModel(): SpamModel {
  if (cached) return cached;
  const file = fileURLToPath(new URL("./model.json", import.meta.url));
  cached = JSON.parse(fs.readFileSync(file, "utf8")) as SpamModel;
  return cached;
}

/** Local spam check. The model is the committed JSON. This call does not use the network. */
export function isLikelySpam(text: string): SpamVerdict {
  return classifyText(text, loadSpamModel());
}
