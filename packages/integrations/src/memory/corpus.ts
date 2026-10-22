import fs from "node:fs";
import path from "node:path";
import { safeFilePart } from "../options.ts";
import {
  eventTitle,
  loadBundle,
  type ClaimRow,
  type SponsorRow,
} from "../seed/load.ts";
import type { RecallHit } from "../types.ts";

export interface CorpusDoc {
  organiserId: string;
  title: string;
  text: string;
  source: string;
  kind: string;
}

const STOP = new Set(
  "a an the of to for and or my which before after in on at by with from that this is are was were be been what who how when your our their it its".split(
    " ",
  ),
);

export function canonicalOrganiser(id: string): string {
  const normal = id.trim().toLowerCase();
  if (
    normal === "c01" ||
    normal === "thames" ||
    normal === "tab" ||
    normal === "@tab_sample" ||
    normal.includes("thames agent")
  ) {
    return "C01";
  }
  return id.trim() || "default";
}

export function tokens(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP.has(token));
}

function claimText(claim: ClaimRow): string {
  const role = claim.role ?? "sponsor";
  return [
    `Sponsors backed this event.`,
    `Company: ${claim.company ?? "unknown"}.`,
    `Role: ${role}.`,
    role.includes("food") || role.includes("drink") ? "This sponsor backed the food." : "",
    `Event: ${claim.event_name ?? claim.event_id ?? "event"}.`,
    `Community: ${claim.community ?? "public"}.`,
    claim.evidence_quote ? `Evidence: ${claim.evidence_quote}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildCorpus(seedDir: string): CorpusDoc[] {
  const bundle = loadBundle(seedDir);
  const docs: CorpusDoc[] = [];
  const sponsorsById = new Map<string, SponsorRow>();
  for (const sponsor of bundle.sampleSponsors) {
    if (sponsor.sponsor_id) sponsorsById.set(sponsor.sponsor_id, sponsor);
  }
  const eventsById = new Map(bundle.sampleEvents.map((event) => [event.event_id, event]));
  const communities = new Map(
    bundle.sampleCommunities.map((community) => [community.community_id, community.name ?? community.community_id]),
  );

  for (const event of bundle.sampleEvents) {
    const sponsor = event.food_sponsor_id ? sponsorsById.get(event.food_sponsor_id) : undefined;
    if (!sponsor) continue;
    const organiserId = event.community_id || "sample";
    docs.push({
      organiserId,
      title: `${sponsor.company} food`,
      kind: "sponsor",
      source: "synthetic-data/events",
      text: `Organiser ${organiserId} (${communities.get(organiserId) ?? organiserId}). Sponsors backed the food before. Food sponsor: ${sponsor.company}. Event: ${eventTitle(event)}. Food cost GBP ${event.food_cost_gbp ?? 0}. Category: ${sponsor.category ?? "food"}.`,
    });
  }

  for (const deal of bundle.sampleDeals) {
    const event = deal.event_id ? eventsById.get(deal.event_id) : undefined;
    const sponsor = deal.sponsor_id ? sponsorsById.get(deal.sponsor_id) : undefined;
    if (!event || !sponsor) continue;
    const organiserId = event.community_id || "sample";
    const food = sponsor.category === "food";
    docs.push({
      organiserId,
      title: `${sponsor.company} deal`,
      kind: "sponsor",
      source: "synthetic-data/sponsor_deals",
      text: `Organiser ${organiserId}. Sponsor ${sponsor.company} backed ${eventTitle(event)}. Outcome: ${deal.outcome ?? "unknown"}. Ask GBP ${deal.ask_gbp ?? 0}. Category: ${sponsor.category ?? "general"}. ${food ? "This sponsor backed the food." : ""} ${deal.notes ?? ""}`.trim(),
    });
  }

  for (const claim of [...bundle.realClaims, ...bundle.newClaims]) {
    docs.push({
      organiserId: "public",
      title: `${claim.company ?? "sponsor"} ${claim.role ?? "sponsor"}`,
      kind: "sponsor",
      source: claim.source_url || "real-data/sponsor_claims",
      text: claimText(claim),
    });
  }

  for (const note of bundle.organiserNotes) {
    docs.push({
      organiserId: "C01",
      title: note.source,
      kind: note.source.includes("whatsapp") || note.source.includes("slack") ? "chat" : "event",
      source: note.source,
      text: note.text,
    });
  }

  return docs;
}

export interface StoredDoc extends CorpusDoc {
  at: string;
}

export function memoryFile(dataDir: string, organiserId: string): string {
  return path.join(dataDir, "memory", `${safeFilePart(canonicalOrganiser(organiserId))}.json`);
}

export function readStored(dataDir: string, organiserId: string): StoredDoc[] {
  try {
    const parsed = JSON.parse(fs.readFileSync(memoryFile(dataDir, organiserId), "utf8")) as {
      docs?: StoredDoc[];
    };
    return Array.isArray(parsed.docs) ? parsed.docs : [];
  } catch {
    return [];
  }
}

export function writeStored(dataDir: string, organiserId: string, docs: StoredDoc[]): void {
  const file = memoryFile(dataDir, organiserId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(
    tmp,
    JSON.stringify({ organiserId: canonicalOrganiser(organiserId), docs }, null, 2),
  );
  fs.renameSync(tmp, file);
}

export function searchDocs(docs: CorpusDoc[], organiserId: string, query: string, limit = 8): RecallHit[] {
  const organiser = canonicalOrganiser(organiserId);
  const queryTokens = tokens(query);
  if (queryTokens.length === 0) return [];
  const scored: RecallHit[] = [];
  for (const doc of docs) {
    const hay = `${doc.title} ${doc.text}`.toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      if (hay.includes(token)) score += 2;
    }
    if (score === 0) continue;
    if (queryTokens.some((token) => token.startsWith("food")) && hay.includes("food")) score += 3;
    if (canonicalOrganiser(doc.organiserId) === organiser) score += 4;
    scored.push({
      organiserId: doc.organiserId,
      title: doc.title,
      text: doc.text.slice(0, 700),
      score,
      source: doc.source,
      kind: doc.kind,
    });
  }
  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  const seen = new Set<string>();
  const hits: RecallHit[] = [];
  for (const hit of scored) {
    const key = `${hit.title}:${hit.text.slice(0, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push(hit);
    if (hits.length >= limit) break;
  }
  return hits;
}

export function normaliseDocs(
  organiserId: string,
  docs: Array<string | { title?: string; text: string; kind?: string; source?: string }>,
): CorpusDoc[] {
  const organiser = canonicalOrganiser(organiserId);
  return docs
    .map((doc, index) => {
      if (typeof doc === "string") {
        return {
          organiserId: organiser,
          title: `Note ${index + 1}`,
          text: doc,
          kind: "note",
          source: "remember",
        };
      }
      return {
        organiserId: organiser,
        title: doc.title?.trim() || `Note ${index + 1}`,
        text: doc.text,
        kind: doc.kind || "note",
        source: doc.source || "remember",
      };
    })
    .filter((doc) => doc.text.trim() !== "");
}
