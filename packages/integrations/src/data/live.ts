import { envValue } from "../options.ts";
import type { ResolvedOptions } from "../options.ts";
import { createBundledData } from "./bundled.ts";
import { companySize as fetchCompanySize } from "./companies-house.ts";
import { devpostLondonHackathons as fetchDevpost } from "./devpost.ts";
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
  };
}

export function companiesHouseUsesApi(env: Record<string, string | undefined>): boolean {
  return envValue(env, "COMPANIES_HOUSE_API_KEY") !== undefined;
}
