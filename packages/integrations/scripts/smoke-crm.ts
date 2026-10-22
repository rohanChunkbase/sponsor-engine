import { createRegistry, readLocalCrm } from "../src/index.ts";
import { baseEnv } from "./smoke-env.ts";

const real = createRegistry();
const crm = real.getStatus().filter((row) => row.slot === "crm");
console.log("CRM connections");
for (const row of crm) {
  console.log(
    `- ${row.name}: connected=${row.connected} active=${row.active} missing=${row.missing.join(",") || "none"}`,
  );
}

const options = baseEnv();
const registry = createRegistry(options);
const lead = await registry.crm.pushSponsorLead(
  "Anthropic",
  { name: "Smoke Contact" },
  "Smoke lead. Draft only.",
  ["https://luma.com/encode-london-2026"],
);
const deal = await registry.crm.pushDeal("Anthropic", "Encode London Hackathon", 1500, "intro");
const file = readLocalCrm(options);
const zero = crm.find((row) => row.id === "zero");
console.log(
  JSON.stringify(
    {
      script: "smoke-crm",
      zeroLiveCall: zero?.connected ? "key-present-but-smoke-uses-builtin" : "not-run",
      lead: { mode: lead.mode, provider: lead.provider, emailSent: lead.data.emailSent },
      deal: { mode: deal.mode, provider: deal.provider, emailSent: deal.data.emailSent },
      localLeads: file.leads.length,
      localDeals: file.deals.length,
    },
    null,
    2,
  ),
);
if (lead.data.emailSent || deal.data.emailSent) process.exit(1);
