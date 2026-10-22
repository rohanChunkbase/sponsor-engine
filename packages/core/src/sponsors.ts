import type { Db } from "@sponsor-engine/db";
import { companySizeIfAvailable, lumaHostsIfAvailable, sponsorEvidence, type SponsorEvidence } from "./integrations.js";
import { recordRun } from "./runs.js";
import type { SponsorMatch } from "./types.js";
import { clip, parseJson } from "./util.js";

type SponsorRow = {
  id: string;
  company: string;
  website: string | null;
  category: string | null;
  roles: string | null;
  london_events: number | null;
  london_events_stated: number | null;
  food_or_drinks_events: number | null;
  venue_events: number | null;
  audiences: string | null;
  evidence_urls: string | null;
  is_sample: string | null;
};

type ClaimRow = {
  company: string;
  event_name: string | null;
  event_date: string | null;
  community: string | null;
  role: string | null;
  confidence: string | null;
  evidence_quote: string | null;
  source_url: string | null;
};

const FOCUS = ["ai", "agent", "llm", "data", "javascript", "js", "web3", "devops", "python", "hackathon", "security", "rust", "cloud", "startup", "design", "ml"];

export async function findSponsors(
  db: Db,
  input: {
    request_id?: string | null;
    community?: string | null;
    headcount?: number | null;
    needs?: string[] | null;
    focus?: string | null;
    limit?: number;
    include_sample?: boolean;
    log?: boolean;
  },
) {
  const request = input.request_id
    ? db.get<{ organisation: string | null; headcount: number | null; needs_json: string | null; venue_hint: string | null }>(
        "SELECT * FROM requests WHERE id = ?",
        [input.request_id],
      )
    : undefined;
  const community = input.community ?? request?.organisation ?? null;
  const headcount = input.headcount ?? request?.headcount ?? null;
  const needs = (input.needs ?? parseJson<string[]>(request?.needs_json, [])).map((need) => need.toLowerCase());
  const focusText = [input.focus, community, request?.venue_hint].filter(Boolean).join(" ");
  const focus = tokens(focusText);
  const communityRow = community
    ? db.get<{ focus: string | null }>(
        "SELECT focus FROM communities WHERE lower(name) LIKE ? LIMIT 1",
        [`%${community.replace(/\s*\(SAMPLE\)\s*/i, "").trim().toLowerCase()}%`],
      )
    : undefined;
  for (const token of tokens(communityRow?.focus || "")) focus.add(token);

  const wantsFood = needs.length === 0 || needs.includes("food") || needs.includes("drinks");
  const wantsVenue = needs.includes("room") || needs.includes("venue");
  const pastEvents = db.all<{ title: string; community_name: string | null; approx_size: number | null }>(
    "SELECT title, community_name, approx_size FROM events WHERE approx_size IS NOT NULL",
  );
  const sponsors = db.all<SponsorRow>(
    input.include_sample
      ? "SELECT * FROM sponsors"
      : "SELECT * FROM sponsors WHERE COALESCE(is_sample, '') != 'SAMPLE'",
  );
  const claims = db.all<ClaimRow>(
    input.include_sample
      ? "SELECT company, event_name, event_date, community, role, confidence, evidence_quote, source_url FROM sponsor_claims"
      : "SELECT company, event_name, event_date, community, role, confidence, evidence_quote, source_url FROM sponsor_claims WHERE COALESCE(is_sample, '') != 'SAMPLE'",
  );
  const byCompany = new Map<string, ClaimRow[]>();
  for (const claim of claims) {
    const key = claim.company.trim().toLowerCase();
    const list = byCompany.get(key) ?? [];
    list.push(claim);
    byCompany.set(key, list);
  }

  const ranked = sponsors
    .map((sponsor) => scoreSponsor(sponsor, uniqueClaims(byCompany.get(sponsor.company.toLowerCase()) ?? []), {
      wantsFood,
      wantsVenue,
      focus,
      community,
      headcount,
      pastEvents,
    }))
    .filter((match) => match.score > 0 && match.sources.length > 0)
    .sort((a, b) => b.score - a.score);

  const limit = input.limit ?? 3;
  let matches = ranked.slice(0, limit);
  if (matches.length < limit) {
    const seen = new Set(matches.map((match) => match.sponsor_id));
    const fillers = sponsors
      .filter((sponsor) => !seen.has(sponsor.id) && urlsOf(sponsor).length > 0)
      .sort((a, b) => (b.london_events_stated || 0) - (a.london_events_stated || 0))
      .slice(0, limit - matches.length)
      .map((sponsor) => filler(sponsor));
    matches = matches.concat(fillers);
  }

  const eventTitle = community
    ? pastEvents.find((event) => (event.community_name || "").toLowerCase().includes(community.toLowerCase()))?.title
    : null;
  let evidence = community ? await sponsorEvidence(community) : [];
  if (evidence.length === 0 && eventTitle) evidence = await sponsorEvidence(eventTitle);
  const evidenceByCompany = new Map(evidence.map((item) => [item.company.toLowerCase(), item]));
  matches = matches.map((match) => attachEvidence(match, evidenceByCompany.get(match.company.toLowerCase())));
  matches = await Promise.all(matches.map(async (match) => {
    const size = await companySizeIfAvailable(match.company);
    return size ? { ...match, company_size: size } : match;
  }));
  const liveHosts = await lumaHostsIfAvailable({ community, headcount, area: request?.venue_hint ?? null });

  if (input.log !== false) {
    recordRun(db, {
      tool: "find_sponsors",
      inputSummary: `${community || "event"} · ${headcount ?? "?"} people · ${needs.join(", ") || "general"}`,
      outputSummary: matches.map((match) => match.company).join(", ") || "No match",
      requestId: input.request_id,
    });
  }

  return {
    matches,
    similar_evidence: evidence,
    live_hosts: liveHosts,
    live_note: liveHosts
      ? "A live lookup added host notes."
      : "Live lookup is off. These matches use the London sponsor list on this computer.",
  };
}

function scoreSponsor(
  sponsor: SponsorRow,
  claims: ClaimRow[],
  input: {
    wantsFood: boolean;
    wantsVenue: boolean;
    focus: Set<string>;
    community: string | null;
    headcount: number | null;
    pastEvents: Array<{ title: string; community_name: string | null; approx_size: number | null }>;
  },
): SponsorMatch {
  let score = 0;
  const reasons: string[] = [];
  const sources: SponsorMatch["sources"] = [];
  const alike = similarClaim(claims, input);
  if (alike) {
    score += 100;
    const range = (alike.evidence_quote || "").match(/\d{2,4}\s*[-–]\s*\d{2,4}/);
    const size = range ? ` The public page says ${range[0]} participants.` : "";
    reasons.push(`Sponsors who backed events like theirs. ${sponsor.company} is listed on ${alike.event_name || "a past event"}.${size}`);
    if (alike.source_url) sources.push(toSource(alike));
  }
  const food = claims.filter((claim) => claim.role === "food" || claim.role === "drinks");
  const statedFood = food.filter((claim) => claim.confidence === "stated" && claim.source_url);
  const venue = claims.filter((claim) => claim.role === "venue");
  const statedVenue = venue.filter((claim) => claim.confidence === "stated" && claim.source_url);

  if (input.wantsFood && statedFood.length) {
    score += 52 + Math.min(statedFood.length, 4) * 6;
    const best = bestClaim(statedFood);
    reasons.push(`${sponsor.company} is named as paying for food or drinks at ${statedFood.length} London event${statedFood.length === 1 ? "" : "s"}. One page says: “${clip(best.evidence_quote || "", 140)}”`);
    sources.push(toSource(best));
  } else if (input.wantsFood && food.length) {
    score += 18;
    const best = bestClaim(food);
    reasons.push(`${sponsor.company} is linked to food at a London event, but the page does not state it as clearly. “${clip(best.evidence_quote || "", 120)}”`);
    if (best.source_url) sources.push(toSource(best));
  } else if (input.wantsFood) {
    score -= 28;
  }

  if (input.wantsVenue && statedVenue.length) {
    score += 22;
    const best = bestClaim(statedVenue);
    reasons.push(`${sponsor.company} has hosted London events. “${clip(best.evidence_quote || "", 120)}”`);
    if (best.source_url) sources.push(toSource(best));
  }

  const blob = [sponsor.category, sponsor.audiences, sponsor.roles, ...claims.map((claim) => `${claim.community || ""} ${claim.event_name || ""}`)].join(" ").toLowerCase();
  const overlap = [...input.focus].filter((word) => blob.includes(word));
  if (overlap.length) {
    score += Math.min(18, overlap.length * 6);
    reasons.push(`Their London events overlap this request on ${overlap.slice(0, 3).join(", ")}.`);
  }

  if (input.community && claims.some((claim) => sameCommunity(claim.community, input.community))) {
    score += 26;
    reasons.push(`They have already backed ${input.community}.`);
  }

  score += Math.min(12, sponsor.london_events_stated || 0);

  if (!sources.length) {
    const url = urlsOf(sponsor)[0];
    const any = claims.find((claim) => claim.source_url);
    if (any?.source_url) sources.push(toSource(any));
    else if (url) {
      sources.push({
        url,
        quote: sponsor.category || "Listed on a public London event page.",
        role: "general",
        confidence: "stated",
        event_name: "",
        community: "",
      });
    }
  }

  return {
    sponsor_id: sponsor.id,
    company: sponsor.company,
    website: sponsor.website,
    category: sponsor.category,
    score,
    is_sample: sponsor.is_sample,
    london_events: sponsor.london_events || 0,
    food_or_drinks_events: sponsor.food_or_drinks_events || 0,
    venue_events: sponsor.venue_events || 0,
    reasons: reasons.slice(0, 3),
    sources: dedupeSources(sources).slice(0, 2),
  };
}

function similarClaim(
  claims: ClaimRow[],
  input: {
    community: string | null;
    headcount: number | null;
    pastEvents: Array<{ title: string; community_name: string | null; approx_size: number | null }>;
  },
): ClaimRow | null {
  if (!input.community || !input.headcount) return null;
  for (const claim of claims) {
    if (!sameCommunity(claim.community, input.community)) continue;
    const event = input.pastEvents.find((row) =>
      sameCommunity(row.community_name, input.community) && titlesMatch(row.title, claim.event_name) && row.approx_size,
    );
    if (!event?.approx_size) continue;
    if (!sizeFits(input.headcount, event.approx_size, claim.evidence_quote || "")) continue;
    return claim;
  }
  return null;
}

function sizeFits(headcount: number, approx: number, evidence: string): boolean {
  const range = evidence.match(/(\d{2,4})\s*[-–]\s*(\d{2,4})/);
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (low <= high && low >= 5 && headcount >= low && headcount <= high) return true;
  }
  const ratio = headcount / approx;
  return ratio >= 0.8 && ratio <= 1.2;
}

function titlesMatch(left: string | null, right: string | null): boolean {
  if (!left || !right) return false;
  const a = left.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const b = right.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return a === b || a.includes(b) || b.includes(a);
}

function attachEvidence(match: SponsorMatch, evidence: SponsorEvidence | undefined): SponsorMatch {
  if (!evidence) return match;
  const reasons = [...match.reasons];
  const sources = [...match.sources];
  const events = evidence.similar_events.slice(0, 2).join(", ");
  if (events && !reasons.some((reason) => reason.includes(events))) {
    reasons.push(`${evidence.company} is also named on similar public events: ${events}.`);
  }
  for (const url of evidence.source_urls) {
    if (sources.some((source) => source.url === url)) continue;
    sources.push({
      url,
      quote: events,
      role: evidence.roles[0] || "sponsor",
      confidence: "stated",
      event_name: evidence.similar_events[0] || "Similar public event",
      community: "",
    });
  }
  return { ...match, reasons, sources };
}

function filler(sponsor: SponsorRow): SponsorMatch {
  const url = urlsOf(sponsor)[0];
  return {
    sponsor_id: sponsor.id,
    company: sponsor.company,
    website: sponsor.website,
    category: sponsor.category,
    score: 1,
    is_sample: sponsor.is_sample,
    london_events: sponsor.london_events || 0,
    food_or_drinks_events: sponsor.food_or_drinks_events || 0,
    venue_events: sponsor.venue_events || 0,
    reasons: [`Weaker match. ${sponsor.company} backs London events, but the pages do not show a close food or venue fit.`],
    sources: url
      ? [{ url, quote: sponsor.category || "Public event page.", role: "general", confidence: "stated", event_name: "", community: "" }]
      : [],
  };
}

function uniqueClaims(claims: ClaimRow[]): ClaimRow[] {
  const seen = new Set<string>();
  const result: ClaimRow[] = [];
  for (const claim of claims) {
    const key = `${claim.event_name}|${claim.role}|${claim.source_url}|${claim.evidence_quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(claim);
  }
  return result;
}

function bestClaim(claims: ClaimRow[]): ClaimRow {
  return [...claims].sort((a, b) => {
    const stated = Number(b.confidence === "stated") - Number(a.confidence === "stated");
    if (stated) return stated;
    return (a.evidence_quote || "").length - (b.evidence_quote || "").length;
  })[0];
}

function toSource(claim: ClaimRow): SponsorMatch["sources"][number] {
  return {
    url: claim.source_url || "",
    quote: claim.evidence_quote || "",
    role: claim.role || "general",
    confidence: claim.confidence || "",
    event_name: claim.event_name || "",
    community: claim.community || "",
  };
}

function dedupeSources(sources: SponsorMatch["sources"]): SponsorMatch["sources"] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    if (!source.url.startsWith("http")) return false;
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function urlsOf(sponsor: SponsorRow): string[] {
  return (sponsor.evidence_urls || "").split(/\s+/).filter((url) => url.startsWith("http"));
}

function tokens(text: string): Set<string> {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  for (const word of FOCUS) {
    if (new RegExp(`\\b${word}\\b`, "i").test(lower)) found.add(word);
  }
  if (found.has("agent") || found.has("llm")) found.add("ai");
  return found;
}

function sameCommunity(left: string | null | undefined, right: string | null): boolean {
  if (!left || !right) return false;
  const a = left.toLowerCase().replace("(sample)", "").trim();
  const b = right.toLowerCase().replace("(sample)", "").trim();
  return a === b || a.includes(b) || b.includes(a);
}
