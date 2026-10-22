import { loadBundle, normalName } from "../seed/load.ts";

export interface SponsorMatch {
  company: string;
  score: number;
  roles: string[];
  similarEvents: string[];
  sourceUrls: string[];
}

export interface SimilarEvent {
  eventId: string;
  name: string;
  community: string | null;
  score: number;
}

export interface FindSponsorsData {
  query: string;
  eventId: string | null;
  eventName: string | null;
  community: string | null;
  sponsors: SponsorMatch[];
  similarEvents: SimilarEvent[];
}

interface ClaimEvent {
  eventId: string;
  name: string;
  community: string | null;
  tokens: Set<string>;
  sponsors: Array<{ company: string; role: string; sourceUrl: string | null }>;
}

const STOP = new Set([
  "the",
  "and",
  "for",
  "with",
  "from",
  "that",
  "this",
  "london",
  "meetup",
  "hackathon",
  "event",
  "events",
  "night",
  "2024",
  "2025",
  "2026",
  "2027",
]);

export function findSponsorsInSeed(seedDir: string, query: string, limit = 8): FindSponsorsData {
  const events = claimEvents(seedDir);
  const needle = query.trim();
  const matched =
    events.find((event) => event.eventId === needle) ??
    events.find((event) => normalName(event.name) === normalName(needle)) ??
    events.find((event) => normalName(event.name).includes(normalName(needle)) && normalName(needle).length > 3);
  const probe = matched ?? {
    eventId: "",
    name: needle,
    community: null,
    tokens: tokens(needle),
    sponsors: [],
  };
  const ranked = events
    .filter((event) => event.eventId !== probe.eventId)
    .map((event) => ({ event, score: similarity(probe, event) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const byCompany = new Map<string, SponsorMatch>();
  for (const row of ranked) {
    const seen = new Set<string>();
    for (const sponsor of row.event.sponsors) {
      const key = normalName(sponsor.company);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const current = byCompany.get(key) ?? {
        company: sponsor.company,
        score: 0,
        roles: [],
        similarEvents: [],
        sourceUrls: [],
      };
      current.score = round(current.score + row.score);
      if (!current.roles.includes(sponsor.role)) current.roles.push(sponsor.role);
      if (!current.similarEvents.includes(row.event.name)) current.similarEvents.push(row.event.name);
      if (sponsor.sourceUrl && !current.sourceUrls.includes(sponsor.sourceUrl)) {
        current.sourceUrls.push(sponsor.sourceUrl);
      }
      byCompany.set(key, current);
    }
  }
  const sponsors = [...byCompany.values()].sort((a, b) => b.score - a.score || a.company.localeCompare(b.company));
  return {
    query,
    eventId: matched?.eventId ?? null,
    eventName: matched?.name ?? null,
    community: matched?.community ?? null,
    sponsors: sponsors.slice(0, limit),
    similarEvents: ranked.map((row) => ({
      eventId: row.event.eventId,
      name: row.event.name,
      community: row.event.community,
      score: round(row.score),
    })),
  };
}

function claimEvents(seedDir: string): ClaimEvent[] {
  const bundle = loadBundle(seedDir);
  const grouped = new Map<string, ClaimEvent>();
  for (const claim of [...bundle.realClaims, ...bundle.newClaims]) {
    const eventId = text(claim.event_id);
    const name = text(claim.event_name) ?? eventId;
    if (!eventId || !name) continue;
    const company = text(claim.company);
    if (!company) continue;
    const current = grouped.get(eventId) ?? {
      eventId,
      name,
      community: text(claim.community),
      tokens: tokens(`${name} ${text(claim.community) ?? ""}`),
      sponsors: [],
    };
    current.sponsors.push({
      company,
      role: text(claim.role) ?? "sponsor",
      sourceUrl: text(claim.source_url),
    });
    grouped.set(eventId, current);
  }
  return [...grouped.values()];
}

function similarity(query: ClaimEvent, other: ClaimEvent): number {
  let score = jaccard(query.tokens, other.tokens);
  if (query.community && other.community && normalName(query.community) === normalName(other.community)) {
    score += 1;
  }
  return score;
}

function tokens(value: string): Set<string> {
  const out = new Set<string>();
  for (const token of normalName(value).split(" ")) {
    if (token.length < 3 || STOP.has(token)) continue;
    out.add(token);
  }
  return out;
}

function jaccard(left: Set<string>, right: Set<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  const union = left.size + right.size - shared;
  return union === 0 ? 0 : shared / union;
}

function text(value: string | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
