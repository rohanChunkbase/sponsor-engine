import type { Db } from "@sponsor-engine/db";
import { recallIfAvailable } from "./integrations.js";
import { recordRun } from "./runs.js";

export async function recallHistory(db: Db, query: string) {
  const text = query.trim();
  const memory = text ? await recallIfAvailable(text, text) : null;
  const like = `%${text.replace(/[%_]/g, "")}%`;
  const events = text
    ? db.all<{ title: string; date: string | null; community_name: string | null; source_url: string | null }>(
        `SELECT title, date, community_name, source_url FROM events
         WHERE title LIKE ? OR community_name LIKE ? OR venue LIKE ? OR area LIKE ?
         ORDER BY date DESC LIMIT 8`,
        [like, like, like, like],
      )
    : [];
  const claims = text
    ? db.all<{ company: string; evidence_quote: string | null; source_url: string | null; event_name: string | null }>(
        `SELECT company, evidence_quote, source_url, event_name FROM sponsor_claims
         WHERE company LIKE ? OR community LIKE ? OR evidence_quote LIKE ? OR event_name LIKE ?
         LIMIT 8`,
        [like, like, like, like],
      )
    : [];
  const bookings = text
    ? db.all<{ title: string; date: string | null; price_gbp: number; requester_kind: string }>(
        `SELECT title, date, price_gbp, requester_kind FROM bookings WHERE title LIKE ? OR venue_area LIKE ? ORDER BY date DESC LIMIT 6`,
        [like, like],
      )
    : [];
  const provider = memory?.provider ?? "";
  recordRun(db, {
    tool: "recall_history",
    inputSummary: text.slice(0, 140),
    outputSummary: memory ? `${provider} · ${memory.hits.length} notes` : `${events.length} events, ${claims.length} sponsor notes.`,
  });
  return {
    source: memory ? `${provider}+local` : "local",
    memory,
    events,
    claims,
    bookings,
    note: memoryNote(provider),
  };
}

function memoryNote(provider: string): string {
  if (provider === "cognee") return "Cognee answered, and the list on this computer is included too.";
  if (provider) return "Built-in memory answered, and the list on this computer is included too.";
  return "Cognee is not connected. This answer uses the bookings and sponsor notes on this computer.";
}
