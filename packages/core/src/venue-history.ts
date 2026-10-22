import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { repoRoot } from "@sponsor-engine/db";
import {
  SAMPLE_CSV_PATH,
  evaluatePricing,
  loadBookingsCsv,
  loadBookingsFile,
  type Booking,
  type EvaluationReport,
} from "@sponsor-engine/pricing";

const MAX_CSV_CHARS = 2_000_000;

export type HistorySource = {
  source: "venue" | "sample";
  path: string;
  label: string;
};

type Cache = {
  key: string;
  bookings: Booking[];
  report: EvaluationReport;
};

let cache: Cache | null = null;

/** A venue file replaces the bundled SAMPLE history. Tests can point this at a temp path. */
export function venueCsvPath(): string {
  const override = process.env.SPONSOR_ENGINE_VENUE_CSV?.trim();
  if (override) return override;
  return join(repoRoot(), "data", "venue-bookings.csv");
}

export function activeHistoryPath(): string {
  const venue = venueCsvPath();
  return existsSync(venue) ? venue : SAMPLE_CSV_PATH;
}

export function historySource(): HistorySource {
  const path = activeHistoryPath();
  if (path === SAMPLE_CSV_PATH) {
    return {
      source: "sample",
      path,
      label: "Bundled SAMPLE history. This file is fictional.",
    };
  }
  return {
    source: "venue",
    path,
    label: "Venue file. New quotes use these rows.",
  };
}

function remember(path: string, bookings: Booking[], report: EvaluationReport): void {
  const mtimeMs = statSync(path).mtimeMs;
  cache = { key: `${path}:${mtimeMs}`, bookings, report };
}

function loadCached(path: string): { bookings: Booking[]; report: EvaluationReport } {
  const mtimeMs = statSync(path).mtimeMs;
  const key = `${path}:${mtimeMs}`;
  if (cache?.key === key) return { bookings: cache.bookings, report: cache.report };
  const bookings = loadBookingsFile(path);
  const report = evaluatePricing(bookings);
  cache = { key, bookings, report };
  return { bookings, report };
}

export function loadActiveHistory(): Booking[] {
  return loadCached(activeHistoryPath()).bookings;
}

export function evaluateActiveHistory(): EvaluationReport & HistorySource {
  const source = historySource();
  const { report } = loadCached(source.path);
  return { ...report, ...source };
}

/** Always the bundled SAMPLE file. Tests use this so a venue upload cannot change the score. */
export function evaluateSampleHistory(): EvaluationReport {
  return evaluatePricing(loadBookingsFile(SAMPLE_CSV_PATH));
}

export function saveVenueCsv(csv: string): { count: number; report: EvaluationReport; source: HistorySource } {
  const text = csv.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("The file is empty.");
  if (text.length > MAX_CSV_CHARS) throw new Error("The file is larger than 2 MB.");
  const bookings = loadBookingsCsv(text);
  const path = venueCsvPath();
  mkdirSync(dirname(path), { recursive: true });
  const body = text.endsWith("\n") ? text : `${text}\n`;
  writeFileSync(path, body, "utf8");
  const report = evaluatePricing(bookings);
  remember(path, bookings, report);
  return { count: bookings.length, report, source: historySource() };
}
