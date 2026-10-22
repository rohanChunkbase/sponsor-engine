import { selectCrm } from "./crm/select.ts";
import { readCrmFile } from "./crm/store.ts";
import type { CrmProvider } from "./crm/types.ts";
import { createBundledData } from "./data/bundled.ts";
import { companiesHouseUsesApi, createLiveData } from "./data/live.ts";
import type { DataSource } from "./data/types.ts";
import { selectMemory } from "./memory/select.ts";
import type { MemoryProvider } from "./memory/types.ts";
import { resolveOptions, type RegistryOptions, type ResolvedOptions } from "./options.ts";
import type { ConnectionStatus, LocalCrmFile } from "./types.ts";

export interface ProviderRegistry {
  crm: CrmProvider;
  memory: MemoryProvider;
  data: DataSource;
  /** Swappable implementations. Stubs are listed and are not selected. */
  catalog: {
    crm: CrmProvider[];
    memory: MemoryProvider[];
    data: DataSource[];
  };
  /** One row per provider for the Connections screen. */
  getStatus(): ConnectionStatus[];
}

function crmDetail(provider: CrmProvider, activeId: string, env: Record<string, string | undefined>): string {
  const missing = provider.missingEnv(env);
  if (!provider.implemented) {
    if (missing.length === 0) {
      return `The key is set. ${provider.label} is a stub, so the built-in CRM stays active.`;
    }
    return `${provider.label} is a stub. Set ${missing.join(" and ")} when you add this adapter.`;
  }
  if (provider.id === "local-crm") {
    return activeId === provider.id
      ? "Active. Records go to crm_export.json. Email is not sent."
      : "Ready. The built-in CRM runs when Zero is not connected.";
  }
  if (provider.isAvailable(env)) {
    return activeId === provider.id
      ? "Active. Zero stores companies, contacts, deals, and draft notes. Email is not sent."
      : "Connected. Another CRM is selected.";
  }
  return `Set ${missing.join(" and ")} to connect Zero. The built-in CRM stays active.`;
}

function memoryDetail(
  provider: MemoryProvider,
  activeId: string,
  env: Record<string, string | undefined>,
): string {
  const missing = provider.missingEnv(env);
  if (!provider.implemented) {
    if (missing.length === 0) {
      return `The key is set. ${provider.label} is a stub, so built-in memory stays active.`;
    }
    return `${provider.label} is a stub. Set ${missing.join(" and ")} when you add this adapter.`;
  }
  if (provider.id === "local-memory") {
    return activeId === provider.id
      ? "Active. Keyword search runs on the bundled notes. No embedding key is used."
      : "Ready. Built-in memory runs when Cognee is not connected.";
  }
  if (provider.isAvailable(env)) {
    return activeId === provider.id
      ? "Active. Cognee stores and recalls organiser memory."
      : "Connected. Built-in memory is selected.";
  }
  return `Set ${missing.join(" and ")} to connect Cognee. Built-in memory stays active.`;
}

function dataStatuses(options: ResolvedOptions): ConnectionStatus[] {
  const offline = options.offline;
  const api = companiesHouseUsesApi(options.env);
  const lumaDetail = offline
    ? "Ready. Live calls are off. Public event JSON needs no key."
    : "No key. Public event JSON is used. A timeout uses the bundled data.";
  const devpostDetail = offline
    ? "Ready. Live calls are off. The hackathon API needs no key."
    : "No key. The public hackathon API is used. A timeout uses the bundled data.";
  const houseDetail = offline
    ? "Ready. Live calls are off. The bundled company note is used."
    : api
      ? "COMPANIES_HOUSE_API_KEY is set, so the official API is used."
      : "The public search page is used. Set COMPANIES_HOUSE_API_KEY to use the official API.";
  return [
    {
      id: "bundled-data",
      name: "Bundled data",
      slot: "data",
      connected: true,
      missing: [],
      active: offline,
      implemented: true,
      detail: offline
        ? "Active. Live calls are off. The bundled files answer."
        : "Ready. The bundled files answer when a live source times out.",
    },
    {
      id: "luma",
      name: "Luma",
      slot: "data",
      connected: true,
      missing: [],
      active: !offline,
      implemented: true,
      detail: lumaDetail,
    },
    {
      id: "devpost",
      name: "Devpost",
      slot: "data",
      connected: true,
      missing: [],
      active: !offline,
      implemented: true,
      detail: devpostDetail,
    },
    {
      id: "companies-house",
      name: "Companies House",
      slot: "data",
      connected: true,
      missing: [],
      active: !offline,
      implemented: true,
      detail: houseDetail,
    },
  ];
}

export function createRegistry(options: RegistryOptions = {}): ProviderRegistry {
  const resolved = resolveOptions(options);
  const crm = selectCrm(resolved);
  const memory = selectMemory(resolved);
  const bundled = createBundledData(resolved);
  const live = createLiveData(resolved);
  const data = resolved.offline ? bundled : live;
  return {
    crm: crm.active,
    memory: memory.active,
    data,
    catalog: {
      crm: crm.catalog,
      memory: memory.catalog,
      data: [bundled, live],
    },
    getStatus() {
      const crmRows: ConnectionStatus[] = crm.catalog.map((provider) => ({
        id: provider.id,
        name: provider.label,
        slot: "crm",
        connected: provider.implemented && provider.isAvailable(resolved.env),
        missing: [...provider.missingEnv(resolved.env)],
        active: provider.id === crm.active.id,
        implemented: provider.implemented,
        detail: crmDetail(provider, crm.active.id, resolved.env),
      }));
      const memoryRows: ConnectionStatus[] = memory.catalog.map((provider) => ({
        id: provider.id,
        name: provider.label,
        slot: "memory",
        connected: provider.implemented && provider.isAvailable(resolved.env),
        missing: [...provider.missingEnv(resolved.env)],
        active: provider.id === memory.active.id,
        implemented: provider.implemented,
        detail: memoryDetail(provider, memory.active.id, resolved.env),
      }));
      return [...crmRows, ...memoryRows, ...dataStatuses(resolved)];
    },
  };
}

export function getStatus(options?: RegistryOptions): ConnectionStatus[] {
  return createRegistry(options).getStatus();
}

export function readLocalCrm(options?: RegistryOptions): LocalCrmFile {
  return readCrmFile(resolveOptions(options).dataDir);
}
