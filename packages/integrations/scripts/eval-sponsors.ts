import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sponsorMatchEval } from "../src/eval/sponsor-match.ts";
import { defaultSeedDir } from "../src/options.ts";

const report = sponsorMatchEval(defaultSeedDir);
const numbers = {
  events: report.events,
  precisionAt3: report.precisionAt3,
  recallAt5: report.recallAt5,
};
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/eval/sponsor-match-report.json");
fs.writeFileSync(file, `${JSON.stringify(numbers, null, 2)}\n`);
console.log(`events ${numbers.events}`);
console.log(`precision@3 ${numbers.precisionAt3}`);
console.log(`recall@5 ${numbers.recallAt5}`);
console.log(`wrote ${file}`);
