import { existsSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { join } from "node:path";
import { currentWorkspace, repoRoot, type Db } from "@sponsor-engine/db";
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

function remember(key: string, bookings: Booking[], report: EvaluationReport): void {
  cache = { key, bookings, report };
}

function loadCached(path: string): { bookings: Booking[]; report: EvaluationReport } {
  const mtimeMs = statSync(path).mtimeMs;
  const key = `${currentWorkspace() ?? "shared"}:${path}:${mtimeMs}`;
  if (cache?.key === key) return { bookings: cache.bookings, report: cache.report };
  const bookings = loadBookingsFile(path);
  const report = evaluatePricing(bookings);
  cache = { key, bookings, report };
  return { bookings, report };
}

function workspaceFile(db?: Db): { bookings: Booking[]; report: EvaluationReport } | null {
  const workspace = currentWorkspace();
  if (!db || !workspace) return null;
  const row = db.get<{ csv: string; updated_at: string }>(
    "SELECT csv, updated_at FROM venue_files WHERE workspace_id = ?",
    [workspace],
  );
  if (!row?.csv) return null;
  const key = `${workspace}:db:${row.updated_at}:${row.csv.length}`;
  if (cache?.key === key) return { bookings: cache.bookings, report: cache.report };
  const bookings = loadBookingsCsv(row.csv);
  const report = evaluatePricing(bookings);
  cache = { key, bookings, report };
  return { bookings, report };
}

export function loadActiveHistory(db?: Db): Booking[] {
  if (currentWorkspace()) {
    return workspaceFile(db)?.bookings ?? loadCached(SAMPLE_CSV_PATH).bookings;
  }
  return loadCached(activeHistoryPath()).bookings;
}

export function evaluateActiveHistory(db?: Db): EvaluationReport & HistorySource {
  if (currentWorkspace()) {
    const stored = workspaceFile(db);
    if (stored) {
      return {
        ...stored.report,
        source: "venue",
        path: "database",
        label: "Venue file for this browser. New quotes use these rows.",
      };
    }
    const report = loadCached(SAMPLE_CSV_PATH).report;
    return {
      ...report,
      source: "sample",
      path: SAMPLE_CSV_PATH,
      label: "Bundled SAMPLE history. This file is fictional.",
    };
  }
  const source = historySource();
  const { report } = loadCached(source.path);
  return { ...report, ...source };
}

/** Always the bundled SAMPLE file. Tests use this so a venue upload cannot change the score. */
export function evaluateSampleHistory(): EvaluationReport {
  return evaluatePricing(loadBookingsFile(SAMPLE_CSV_PATH));
}

export function saveVenueCsv(csv: string, db?: Db): { count: number; report: EvaluationReport; source: HistorySource } {
  const text = csv.replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("The file is empty.");
  if (text.length > MAX_CSV_CHARS) throw new Error("The file is larger than 2 MB.");
  const bookings = loadBookingsCsv(text);
  // Score the file before any write. A short or invalid history must leave the previous file in place.
  const report = evaluatePricing(bookings);
  const workspace = currentWorkspace();
  const body = text.endsWith("\n") ? text : `${text}\n`;
  if (db && workspace) {
    const updated = new Date().toISOString();
    db.run(
      `INSERT INTO venue_files (workspace_id, csv, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(workspace_id) DO UPDATE SET csv = excluded.csv, updated_at = excluded.updated_at`,
      [workspace, body, updated],
    );
    remember(`${workspace}:db:${updated}:${body.length}`, bookings, report);
    return {
      count: bookings.length,
      report,
      source: { source: "venue", path: "database", label: "Venue file for this browser. New quotes use these rows." },
    };
  }
  const path = venueCsvPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, "utf8");
  const mtimeMs = statSync(path).mtimeMs;
  remember(`${currentWorkspace() ?? "shared"}:${path}:${mtimeMs}`, bookings, report);
  return { count: bookings.length, report, source: historySource() };
}

/** Delete the venue file and use the bundled SAMPLE history again. */
export function resetVenueHistory(db?: Db): HistorySource {
  const workspace = currentWorkspace();
  if (db && workspace) {
    db.run("DELETE FROM venue_files WHERE workspace_id = ?", [workspace]);
  }
  if (!workspace) {
    const path = venueCsvPath();
    if (existsSync(path)) unlinkSync(path);
  }
  cache = null;
  if (workspace) {
    return {
      source: "sample",
      path: SAMPLE_CSV_PATH,
      label: "Bundled SAMPLE history. This file is fictional.",
    };
  }
  return historySource();
}
