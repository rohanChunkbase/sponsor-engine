import path from "node:path";
import { API_USER_AGENT, BROWSER_USER_AGENT, parseJson, politeInterval, requestText } from "../http.ts";
import { envValue } from "../options.ts";
import type { ResolvedOptions } from "../options.ts";
import { errorText, liveResult } from "../result.ts";
import { findSponsor, loadBundle } from "../seed/load.ts";
import type { CompanySize, ProviderResult, SicCode } from "../types.ts";
import {
  companySizeNote,
  emptyCompany,
  parseCompanyProfileHtml,
  parseCompanySearchHtml,
} from "./parse.ts";
import type { DataSource } from "./types.ts";

const API = "https://api.company-information.service.gov.uk";
const WEB = "https://find-and-update.company-information.service.gov.uk";

interface ApiSearchItem {
  company_number?: string;
  title?: string;
  company_status?: string;
  date_of_creation?: string;
  address_snippet?: string;
}

interface ApiProfile {
  company_name?: string;
  company_number?: string;
  company_status?: string;
  date_of_creation?: string;
  sic_codes?: string[];
  registered_office_address?: Record<string, string | undefined>;
}

function bundleNote(seedDir: string, name: string): string | undefined {
  const sponsor = findSponsor(loadBundle(seedDir), name);
  if (!sponsor) return undefined;
  return companySizeNote({
    category: sponsor.category,
    londonEvents: sponsor.london_events ?? sponsor.london_events_found,
  });
}

function formatAddress(address: Record<string, string | undefined> | undefined): string | null {
  if (!address) return null;
  const text = ["address_line_1", "address_line_2", "locality", "region", "postal_code", "country"]
    .map((key) => address[key])
    .filter((part): part is string => Boolean(part))
    .join(", ");
  return text || null;
}

async function getText(
  url: string,
  options: ResolvedOptions,
  headers: Record<string, string>,
): Promise<{ status: number; text: string; fromCache: boolean }> {
  return requestText({
    url,
    headers,
    timeoutMs: options.timeoutMs,
    fetchImpl: options.fetchImpl,
    lane: "companies-house",
    minIntervalMs: politeInterval(options.fetchImpl, 1000),
    cacheDir: path.join(options.dataDir, "cache", "companies-house"),
    cacheTtlMs: options.cacheTtlMs,
  });
}

async function fromOfficialApi(name: string, options: ResolvedOptions): Promise<CompanySize> {
  const key = envValue(options.env, "COMPANIES_HOUSE_API_KEY") ?? "";
  const auth = `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
  const headers = {
    Authorization: auth,
    Accept: "application/json",
    "User-Agent": API_USER_AGENT,
  };
  const searchUrl = `${API}/search/companies?q=${encodeURIComponent(name)}&items_per_page=5`;
  const search = await getText(searchUrl, options, headers);
  if (search.status < 200 || search.status >= 300) throw new Error(`Companies House HTTP ${search.status}`);
  const body = parseJson(search.text) as { items?: ApiSearchItem[] };
  const items = Array.isArray(body.items) ? body.items : [];
  const needle = name.trim().toLowerCase();
  const picked =
    items.find((item) => item.title?.trim().toLowerCase() === needle) ??
    items.find((item) => item.title?.toLowerCase().includes(needle)) ??
    items[0];
  if (!picked?.company_number) {
    return emptyCompany(name, "official-api", "Companies House returned no company.");
  }
  const profileUrl = `${API}/company/${encodeURIComponent(picked.company_number)}`;
  const profileRes = await getText(profileUrl, options, headers);
  if (profileRes.status < 200 || profileRes.status >= 300) {
    throw new Error(`Companies House HTTP ${profileRes.status}`);
  }
  const profile = parseJson(profileRes.text) as ApiProfile;
  const sicCodes: SicCode[] = (profile.sic_codes ?? []).map((code) => ({ code }));
  return {
    query: name,
    matchedName: profile.company_name ?? picked.title ?? null,
    companyNumber: profile.company_number ?? picked.company_number,
    status: profile.company_status ?? picked.company_status ?? null,
    incorporatedOn: profile.date_of_creation ?? picked.date_of_creation ?? null,
    sicCodes,
    address: formatAddress(profile.registered_office_address) ?? picked.address_snippet ?? null,
    sizeNote: companySizeNote({
      status: profile.company_status ?? picked.company_status,
      incorporatedOn: profile.date_of_creation ?? picked.date_of_creation,
      sicCount: sicCodes.length,
    }),
    sourceUrl: `${WEB}/company/${picked.company_number}`,
    via: "official-api",
  };
}

async function fromPublicPage(name: string, options: ResolvedOptions): Promise<CompanySize> {
  const headers = {
    Accept: "text/html",
    "User-Agent": BROWSER_USER_AGENT,
  };
  const searchUrl = `${WEB}/search/companies?q=${encodeURIComponent(name)}`;
  const search = await getText(searchUrl, options, headers);
  if (search.status < 200 || search.status >= 300) throw new Error(`Companies House page HTTP ${search.status}`);
  const hits = parseCompanySearchHtml(search.text);
  if (hits.length === 0) {
    return emptyCompany(name, "public-page", "The public search page returned no company.");
  }
  const profileUrl = `${WEB}/company/${hits[0].number}`;
  const profile = await getText(profileUrl, options, headers);
  if (profile.status < 200 || profile.status >= 300) {
    throw new Error(`Companies House page HTTP ${profile.status}`);
  }
  const parsed = parseCompanyProfileHtml(profile.text);
  return {
    query: name,
    matchedName: parsed.name ?? hits[0].name,
    companyNumber: hits[0].number,
    status: parsed.status,
    incorporatedOn: parsed.incorporatedOn,
    sicCodes: parsed.sicCodes,
    address: null,
    sizeNote: companySizeNote({
      status: parsed.status,
      incorporatedOn: parsed.incorporatedOn,
      sicCount: parsed.sicCodes.length,
    }),
    sourceUrl: profileUrl,
    via: "public-page",
  };
}

export async function companySize(
  name: string,
  options: ResolvedOptions,
  bundled: DataSource,
): Promise<ProviderResult<CompanySize>> {
  if (!name.trim()) {
    return bundled.companySize(name);
  }
  if (options.offline) return bundled.companySize(name);
  const useApi = envValue(options.env, "COMPANIES_HOUSE_API_KEY") !== undefined;
  try {
    const data = useApi ? await fromOfficialApi(name, options) : await fromPublicPage(name, options);
    if (!data.matchedName) {
      const extra = bundleNote(options.seedDir, name);
      if (extra) data.sizeNote = `${data.sizeNote} ${extra}`;
    }
    return liveResult(useApi ? "companies-house" : "companies-house", data);
  } catch (error) {
    const fallback = await bundled.companySize(name);
    return {
      ...fallback,
      warning: `Companies House did not respond (${errorText(error)}). Bundled data was used.`,
    };
  }
}
