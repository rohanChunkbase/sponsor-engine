import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findSponsorsInSeed } from "../data/sponsors.ts";
import { normalName } from "../seed/load.ts";

export interface SponsorLabel {
  company: string;
  role: string;
  sourceUrl: string | null;
}

export interface EventLabel {
  eventId: string;
  name: string;
  community: string | null;
  sponsors: SponsorLabel[];
}

export interface SponsorMatchRow {
  eventId: string;
  name: string;
  precisionAt3: number;
  recallAt5: number;
  predicted: string[];
  truth: string[];
}

export interface SponsorMatchNumbers {
  events: number;
  precisionAt3: number;
  recallAt5: number;
}

export interface SponsorMatchReport extends SponsorMatchNumbers {
  rows: SponsorMatchRow[];
}

export function sponsorMatchEval(seedDir: string, labels: EventLabel[] = loadSponsorLabels()): SponsorMatchReport {
  const rows = labels.map((label) => scoreEvent(seedDir, label));
  return {
    events: rows.length,
    precisionAt3: round(mean(rows.map((row) => row.precisionAt3))),
    recallAt5: round(mean(rows.map((row) => row.recallAt5))),
    rows,
  };
}

export function loadSponsorLabels(): EventLabel[] {
  const file = fileURLToPath(new URL("./sponsor-labels.json", import.meta.url));
  return JSON.parse(fs.readFileSync(file, "utf8")) as EventLabel[];
}

export function loadSponsorMatchReport(): SponsorMatchNumbers {
  const file = fileURLToPath(new URL("./sponsor-match-report.json", import.meta.url));
  return JSON.parse(fs.readFileSync(file, "utf8")) as SponsorMatchNumbers;
}

function scoreEvent(seedDir: string, label: EventLabel): SponsorMatchRow {
  const ranked = findSponsorsInSeed(seedDir, label.eventId, 8);
  const predicted = unique(ranked.sponsors.map((sponsor) => sponsor.company));
  const truth = unique(label.sponsors.map((sponsor) => sponsor.company));
  const truthSet = new Set(truth.map(normalName));
  const top3 = predicted.slice(0, 3);
  const top5 = predicted.slice(0, 5);
  const hit3 = top3.filter((company) => truthSet.has(normalName(company))).length;
  const hit5 = top5.filter((company) => truthSet.has(normalName(company))).length;
  return {
    eventId: label.eventId,
    name: label.name,
    precisionAt3: round(hit3 / 3),
    recallAt5: truth.length === 0 ? 0 : round(hit5 / truth.length),
    predicted: top5,
    truth,
  };
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = normalName(value);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function labelsPath(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}
