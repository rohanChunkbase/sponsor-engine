import fs from "node:fs";
import path from "node:path";
import type { CrmDealRecord, CrmLeadRecord, LocalCrmFile } from "../types.ts";

const tails = new Map<string, Promise<unknown>>();

function withLock<T>(file: string, fn: () => T): Promise<T> {
  const prev = tails.get(file) ?? Promise.resolve();
  const run = prev.then(fn, fn);
  tails.set(
    file,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

export function crmFilePath(dataDir: string): string {
  return path.join(dataDir, "crm_export.json");
}

export function readCrmFile(dataDir: string): LocalCrmFile {
  const file = crmFilePath(dataDir);
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as LocalCrmFile;
    return {
      provider: "local-crm",
      updatedAt: parsed.updatedAt ?? new Date(0).toISOString(),
      leads: Array.isArray(parsed.leads) ? parsed.leads : [],
      deals: Array.isArray(parsed.deals) ? parsed.deals : [],
    };
  } catch {
    return { provider: "local-crm", updatedAt: new Date(0).toISOString(), leads: [], deals: [] };
  }
}

function writeCrmFile(dataDir: string, file: LocalCrmFile): void {
  fs.mkdirSync(dataDir, { recursive: true });
  const target = crmFilePath(dataDir);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(file, null, 2));
  fs.renameSync(tmp, target);
}

export function appendLead(dataDir: string, lead: CrmLeadRecord): Promise<void> {
  const file = crmFilePath(dataDir);
  return withLock(file, () => {
    const current = readCrmFile(dataDir);
    current.leads.push(lead);
    current.updatedAt = new Date().toISOString();
    writeCrmFile(dataDir, current);
  });
}

export function appendDeal(dataDir: string, deal: CrmDealRecord): Promise<void> {
  const file = crmFilePath(dataDir);
  return withLock(file, () => {
    const current = readCrmFile(dataDir);
    current.deals.push(deal);
    current.updatedAt = new Date().toISOString();
    writeCrmFile(dataDir, current);
  });
}
