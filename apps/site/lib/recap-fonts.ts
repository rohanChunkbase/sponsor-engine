import { readFile } from "node:fs/promises";
import path from "node:path";

export type RecapFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600;
  style: "normal";
};

async function readFont(fileName: string): Promise<Buffer> {
  const candidates = [
    path.join(process.cwd(), "assets/fonts", fileName),
    path.join(process.cwd(), "apps/site/assets/fonts", fileName),
  ];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch {
      // The next candidate covers `next start` and a test run from the repo root.
    }
  }
  throw new Error(`Missing font ${fileName}`);
}

export async function loadRecapFonts(): Promise<RecapFont[]> {
  const [regular, semibold] = await Promise.all([readFont("Inter-400.ttf"), readFont("Inter-600.ttf")]);
  return [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: semibold, weight: 600, style: "normal" },
  ];
}
