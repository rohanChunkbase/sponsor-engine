import type { Db } from "@sponsor-engine/db";
import { listFailures } from "./failures.js";
import { parseJson } from "./util.js";

export function inbox(db: Db) {
  const requests = db.all<Record<string, unknown>>(
    `SELECT r.*, t.id AS task_id, t.title AS task_title, t.owner, t.priority, t.status AS task_status
     FROM requests r
     LEFT JOIN tasks t ON t.request_id = r.id
     ORDER BY r.created_at DESC`,
  );
  const outbox = db.all<Record<string, unknown>>("SELECT * FROM outbox ORDER BY created_at DESC");
  return {
    requests: requests.map((row) => ({
      ...row,
      needs: parseJson<string[]>(String(row.needs_json ?? "[]"), []),
      outbox: outbox.filter((item) => item.request_id === row.id),
    })),
    failures: listFailures(db, 12),
    counts: counts(db),
  };
}

export function counts(db: Db) {
  return {
    sponsors: scalar(db, "sponsors"),
    events: scalar(db, "events"),
    bookings: scalar(db, "bookings"),
    communities: scalar(db, "communities"),
    requests: scalar(db, "requests"),
    claims: scalar(db, "sponsor_claims"),
  };
}

export function latestQuote(db: Db, requestId: string) {
  return db.get<Record<string, unknown>>(
    "SELECT * FROM quotes WHERE request_id = ? ORDER BY created_at DESC LIMIT 1",
    [requestId],
  );
}

export function listRuns(db: Db, limit = 40) {
  return db.all<Record<string, unknown>>(
    "SELECT * FROM agent_runs ORDER BY started_at DESC LIMIT ?",
    [limit],
  );
}

export function mapPoints(db: Db) {
  return db.all<{
    id: string;
    title: string;
    date: string | null;
    lat: number;
    lon: number;
    community_name: string | null;
    area: string | null;
    venue: string | null;
    is_sample: string | null;
    source_url: string | null;
  }>(
    `SELECT e.id, e.title, e.date, e.lat, e.lon,
            COALESCE(e.community_name, c.name) AS community_name,
            e.area, e.venue, e.is_sample, e.source_url
     FROM events e
     LEFT JOIN communities c ON c.id = e.community_id
     WHERE e.lat IS NOT NULL AND e.lon IS NOT NULL`,
  );
}

function scalar(db: Db, table: string): number {
  const row = db.get<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`);
  return row?.n ?? 0;
}
