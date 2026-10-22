import type {
  CompanySize,
  DevpostHackathon,
  LumaEventHosts,
  ProviderResult,
} from "../types.ts";

/**
 * Data source. The bundled files are the default.
 * Luma, Devpost, and Companies House are tried when the network is on.
 */
export interface DataSource {
  readonly id: string;
  readonly label: string;
  readonly slot: "data";
  readonly implemented: boolean;
  readonly requiredEnv: readonly string[];
  isAvailable(env: Record<string, string | undefined>): boolean;
  missingEnv(env: Record<string, string | undefined>): string[];
  lumaEventHosts(eventUrlOrId: string): Promise<ProviderResult<LumaEventHosts>>;
  devpostLondonHackathons(): Promise<ProviderResult<DevpostHackathon[]>>;
  companySize(name: string): Promise<ProviderResult<CompanySize>>;
}
