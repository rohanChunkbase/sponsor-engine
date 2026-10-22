import type { ResolvedOptions } from "../options.ts";
import { createLocalCrm } from "./local.ts";
import { createCrmStubs } from "./stubs.ts";
import type { CrmProvider } from "./types.ts";
import { createZeroCrm } from "./zero.ts";

const PRIORITY = ["zero", "twenty", "hubspot", "notion", "google-sheets"] as const;

export interface CrmSelection {
  active: CrmProvider;
  catalog: CrmProvider[];
}

export function selectCrm(options: ResolvedOptions): CrmSelection {
  const local = createLocalCrm(options);
  const catalog = [local, createZeroCrm(options, local), ...createCrmStubs(local)];
  const forced = options.crm
    ? catalog.find((provider) => provider.id === options.crm)
    : undefined;
  if (forced?.implemented && forced.isAvailable(options.env)) {
    return { active: forced, catalog };
  }
  for (const id of PRIORITY) {
    const provider = catalog.find((item) => item.id === id);
    if (provider?.implemented && provider.isAvailable(options.env)) {
      return { active: provider, catalog };
    }
  }
  return { active: local, catalog };
}
