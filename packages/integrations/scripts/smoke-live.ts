import { createRegistry } from "../src/index.ts";

const registry = createRegistry();
console.log("Data connections");
for (const row of registry.getStatus().filter((item) => item.slot === "data")) {
  console.log(
    `- ${row.name}: connected=${row.connected} active=${row.active} missing=${row.missing.join(",") || "none"}`,
  );
}

const luma = await registry.data.lumaEventHosts("evt-Yz7RR89Zlv56tya");
const devpost = await registry.data.devpostLondonHackathons();
const company = await registry.data.companySize("Cloudflare");

console.log(
  JSON.stringify(
    {
      script: "smoke-live",
      luma: {
        mode: luma.mode,
        provider: luma.provider,
        cached: luma.cached ?? false,
        name: luma.data.name,
        hosts: luma.data.hosts.length,
        sponsors: luma.data.sponsors.length,
        warning: luma.warning ?? null,
      },
      devpost: {
        mode: devpost.mode,
        provider: devpost.provider,
        cached: devpost.cached ?? false,
        count: devpost.data.length,
        first: devpost.data[0]?.title ?? null,
        organiser: devpost.data[0]?.organizationName ?? null,
        warning: devpost.warning ?? null,
      },
      companiesHouse: {
        mode: company.mode,
        provider: company.provider,
        via: company.data.via,
        matchedName: company.data.matchedName,
        status: company.data.status,
        incorporatedOn: company.data.incorporatedOn,
        sic: company.data.sicCodes.map((code) => code.code),
        warning: company.warning ?? null,
      },
    },
    null,
    2,
  ),
);
