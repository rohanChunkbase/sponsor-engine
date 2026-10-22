import fs from "node:fs";
import path from "node:path";

export interface SponsorRow {
  company: string;
  website?: string;
  category?: string;
  london_events?: number;
  london_events_found?: number;
  roles?: string;
  is_sample?: string;
  sponsor_id?: string;
  typical_ask_gbp?: number;
}

export interface EventRow {
  event_id?: string;
  name?: string;
  title?: string;
  url?: string;
  date?: string;
  community?: string;
  community_id?: string;
  source_url?: string;
  food_sponsor_id?: string;
  food_cost_gbp?: number;
  lat?: number | null;
  lon?: number | null;
  venue?: string | null;
  approx_size?: number | null;
}

export interface ClaimRow {
  event_id?: string;
  event_name?: string;
  company?: string;
  role?: string;
  confidence?: string;
  evidence_quote?: string;
  source_url?: string;
  community?: string;
}

export interface DealRow {
  deal_id?: string;
  event_id?: string;
  sponsor_id?: string;
  ask_gbp?: number;
  outcome?: string;
  amount_gbp?: number;
  notes?: string;
}

export interface CommunityRow {
  community_id?: string;
  name?: string;
  focus?: string;
}

export interface SampleLumaEvent {
  id?: string;
  name?: string;
  url?: string;
  start_at?: string;
  hosts?: Array<Record<string, unknown>>;
}

export interface SeedBundle {
  realSponsors: SponsorRow[];
  realEvents: EventRow[];
  realClaims: ClaimRow[];
  newSponsors: SponsorRow[];
  newEvents: EventRow[];
  newClaims: ClaimRow[];
  sampleSponsors: SponsorRow[];
  sampleEvents: EventRow[];
  sampleDeals: DealRow[];
  sampleCommunities: CommunityRow[];
  sampleLuma: SampleLumaEvent[];
  organiserNotes: Array<{ source: string; text: string }>;
}

const cache = new Map<string, SeedBundle>();

function readJson(file: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function records<T>(file: string): T[] {
  const parsed = readJson(file);
  if (Array.isArray(parsed)) return parsed as T[];
  if (parsed && typeof parsed === "object" && Array.isArray((parsed as { records?: unknown }).records)) {
    return (parsed as { records: T[] }).records;
  }
  return [];
}

function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

export function loadBundle(seedDir: string): SeedBundle {
  const cached = cache.get(seedDir);
  if (cached) return cached;
  const real = path.join(seedDir, "real-data");
  const extra = path.join(real, "new_2026-10-22");
  const sample = path.join(seedDir, "synthetic-data");
  const lumaDir = path.join(sample, "luma");
  const sampleLuma: SampleLumaEvent[] = [];
  if (fs.existsSync(lumaDir)) {
    for (const name of fs.readdirSync(lumaDir)) {
      if (!name.startsWith("events_get_") || !name.endsWith(".json")) continue;
      const parsed = readJson(path.join(lumaDir, name));
      if (parsed && typeof parsed === "object") sampleLuma.push(parsed as SampleLumaEvent);
    }
  }
  const noteFiles = [
    ["past-events", path.join(sample, "organiser_history", "past_events_summary_SAMPLE.md")],
    ["sponsor-email", path.join(sample, "organiser_history", "sponsor_email_threads_SAMPLE.txt")],
    ["run-of-show", path.join(sample, "organiser_history", "run_of_show_template_SAMPLE.md")],
    ["whatsapp", path.join(sample, "chat_exports", "whatsapp_thames_agent_builders_SAMPLE.txt")],
    ["slack", path.join(sample, "chat_exports", "slack_organisers_SAMPLE.json")],
  ] as const;
  const organiserNotes = noteFiles
    .map(([source, file]) => ({ source, text: readText(file).trim() }))
    .filter((item) => item.text !== "");

  const bundle: SeedBundle = {
    realSponsors: records(path.join(real, "json", "sponsors.json")),
    realEvents: records(path.join(real, "json", "events.json")),
    realClaims: records(path.join(real, "json", "sponsor_claims.json")),
    newSponsors: records(path.join(extra, "sponsors_new.json")),
    newEvents: records(path.join(extra, "events_new.json")),
    newClaims: records(path.join(extra, "sponsor_claims_new.json")),
    sampleSponsors: records(path.join(sample, "json", "sponsors.json")),
    sampleEvents: records(path.join(sample, "json", "events.json")),
    sampleDeals: records(path.join(sample, "json", "sponsor_deals.json")),
    sampleCommunities: records(path.join(sample, "json", "communities.json")),
    sampleLuma,
    organiserNotes,
  };
  cache.set(seedDir, bundle);
  return bundle;
}

export function normalName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function findSponsor(bundle: SeedBundle, name: string): SponsorRow | undefined {
  const needle = normalName(name);
  if (!needle) return undefined;
  const rows = [...bundle.realSponsors, ...bundle.newSponsors, ...bundle.sampleSponsors];
  const exact = rows.find((row) => normalName(row.company) === needle);
  if (exact) return exact;
  return rows.find((row) => {
    const company = normalName(row.company);
    return company.includes(needle) || needle.includes(company);
  });
}

export function companyDomain(website: string | undefined): string | undefined {
  if (!website) return undefined;
  try {
    const withScheme = website.includes("://") ? website : `https://${website}`;
    return new URL(withScheme).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

export function eventTitle(event: EventRow): string {
  return event.name || event.title || event.event_id || "event";
}
