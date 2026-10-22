import { envValue } from "../options.ts";
import type { ResolvedOptions } from "../options.ts";
import { createBundledData } from "./bundled.ts";
import { companySize as fetchCompanySize } from "./companies-house.ts";
import { devpostProjects as fetchDevpostProjects } from "./devpost-projects.ts";
import { devpostLondonHackathons as fetchDevpost } from "./devpost.ts";
import { githubProfile as fetchGithubProfile } from "./github.ts";
import { hackerNewsStories as fetchHackerNews } from "./hackernews.ts";
import { buildLondonEventsIndex } from "./london-index.ts";
import { buildOrganiserLeads } from "./organisers.ts";
import { findSponsorsInSeed } from "./sponsors.ts";
import { builtinResult } from "../result.ts";
import { lumaEventHosts as fetchLumaEventHosts } from "./luma.ts";
import type { DataSource } from "./types.ts";

export function createLiveData(options: ResolvedOptions): DataSource {
  const bundled = createBundledData(options);
  return {
    id: "live-data",
    label: "Live public data",
    slot: "data",
    implemented: true,
    requiredEnv: [],
    isAvailable: () => true,
    missingEnv: () => [],
    lumaEventHosts(eventUrlOrId) {
      return fetchLumaEventHosts(eventUrlOrId, options, bundled);
    },
    devpostLondonHackathons() {
      return fetchDevpost(options, bundled);
    },
    companySize(name) {
      return fetchCompanySize(name, options, bundled);
    },
    londonEventsIndex() {
      return buildLondonEventsIndex(options);
    },
    findSponsors(query) {
      const data = findSponsorsInSeed(options.seedDir, query);
      const warning = data.sponsors.length === 0 ? "No similar events have sponsor claims." : undefined;
      return Promise.resolve(builtinResult("sponsor-claims", data, warning));
    },
    organiserLeads() {
      return buildOrganiserLeads(options);
    },
    devpostProjects(query) {
      return fetchDevpostProjects(query, options);
    },
    githubProfile(handle) {
      return fetchGithubProfile(handle, options);
    },
    hackerNewsStories(handle) {
      return fetchHackerNews(handle, options);
    },
  };
}

export function companiesHouseUsesApi(env: Record<string, string | undefined>): boolean {
  return envValue(env, "COMPANIES_HOUSE_API_KEY") !== undefined;
}
