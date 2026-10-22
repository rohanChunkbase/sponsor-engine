import assert from "node:assert/strict";
import test from "node:test";
import { assertZeroRecordPath } from "../src/crm/draft.ts";
import { pushDeal, pushSponsorLead, readLocalCrm } from "../src/index.ts";
import { baseOptions, header } from "./helpers.ts";

interface Seen {
  url: string;
  method: string;
  json: Record<string, unknown> | undefined;
  authorization: string | null;
}

function jsonFetch(routes: Record<string, unknown>): { fetchImpl: typeof fetch; seen: Seen[] } {
  const seen: Seen[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    const raw = typeof init?.body === "string" ? init.body : undefined;
    seen.push({
      url,
      method: init?.method ?? "GET",
      json: raw ? (JSON.parse(raw) as Record<string, unknown>) : undefined,
      authorization: header(init, "authorization"),
    });
    const path = new URL(url).pathname;
    const payload = routes[path];
    if (!payload) return new Response(JSON.stringify({ error: "missing" }), { status: 404 });
    return new Response(JSON.stringify(payload), { status: 201 });
  };
  return { fetchImpl, seen };
}

test("no key writes crm_export.json and does not throw", async () => {
  const options = baseOptions();
  const lead = await pushSponsorLead(
    "Anthropic",
    { name: "Ada" },
    "Met at the hackathon",
    ["https://luma.com/encode-london-2026"],
    options,
  );
  const deal = await pushDeal("Anthropic", "Encode London Hackathon", 1500, "intro", options);
  assert.equal(lead.ok, true);
  assert.equal(lead.mode, "builtin");
  assert.equal(lead.provider, "local-crm");
  assert.equal(lead.data.emailSent, false);
  assert.equal(lead.data.draft, true);
  assert.equal(deal.data.emailSent, false);
  assert.equal(deal.data.currency, "GBP");
  const file = readLocalCrm(options);
  assert.equal(file.leads.length, 1);
  assert.equal(file.deals.length, 1);
  assert.equal(file.leads[0]?.company, "Anthropic");
  assert.equal(file.deals[0]?.askAmount, 1500);
});

test("Zero creates company, contact, note, and deal records and never an email", async () => {
  const { fetchImpl, seen } = jsonFetch({
    "/api/companies": { data: { id: "co-1" } },
    "/api/contacts": { data: { id: "ct-1" } },
    "/api/notes": { data: { id: "nt-1" } },
    "/api/deals": { data: { id: "dl-1" } },
  });
  const options = baseOptions({
    env: { ZERO_API_KEY: "test-key", ZERO_WORKSPACE_ID: "ws-1" },
    fetchImpl,
  });
  const lead = await pushSponsorLead(
    "Anthropic",
    { name: "Ada", email: "ada@anthropic.com", title: "DevRel", linkedin: "ada" },
    "Met at the hackathon",
    ["https://luma.com/encode-london-2026"],
    options,
  );
  assert.equal(lead.mode, "live");
  assert.equal(lead.provider, "zero");
  assert.equal(lead.data.emailSent, false);
  assert.equal(lead.data.companyId, "co-1");
  assert.equal(lead.data.contactId, "ct-1");
  assert.equal(lead.data.noteId, "nt-1");

  const company = seen.find((call) => call.url.endsWith("/api/companies"));
  assert.equal(company?.json?.workspaceId, "ws-1");
  assert.equal(company?.json?.name, "Anthropic");
  assert.equal(company?.json?.domain, "anthropic.com");
  assert.equal(company?.json?.source, "sponsor-engine");
  assert.equal(company?.authorization, "Bearer test-key");

  const contact = seen.find((call) => call.url.endsWith("/api/contacts"));
  assert.equal(contact?.json?.companyId, "co-1");
  assert.equal(contact?.json?.email, "ada@anthropic.com");

  const note = seen.find((call) => call.url.endsWith("/api/notes"));
  const content = JSON.stringify(note?.json?.content);
  assert.match(content, /Draft only/);
  assert.match(content, /Do not send this text as email/);
  assert.match(content, /luma.com\/encode-london-2026/);
  for (const call of seen) {
    assert.doesNotMatch(call.url, /sequence|emails|message|outreach|mailbox/i);
  }

  seen.length = 0;
  const deal = await pushDeal("Anthropic", "Encode London Hackathon", 2500, "intro", options);
  assert.equal(deal.mode, "live");
  assert.equal(deal.data.dealId, "dl-1");
  assert.equal(deal.data.emailSent, false);
  const dealCall = seen.find((call) => call.url.endsWith("/api/deals"));
  assert.equal(dealCall?.json?.value, 2500);
  assert.equal(dealCall?.json?.stage, "intro");
  assert.equal(dealCall?.json?.name, "Anthropic — Encode London Hackathon");

  for (const call of seen) {
    assert.doesNotMatch(call.url, /sequence|email|message|outreach|mailbox/i);
  }
});

test("a Zero HTTP error stores the lead locally", async () => {
  const options = baseOptions({
    env: { ZERO_API_KEY: "test-key", ZERO_WORKSPACE_ID: "ws-1" },
    fetchImpl: async () => new Response("nope", { status: 500 }),
  });
  const lead = await pushSponsorLead("Anthropic", { name: "Ada" }, "draft", undefined, options);
  assert.equal(lead.mode, "builtin");
  assert.equal(lead.data.emailSent, false);
  assert.match(lead.warning ?? "", /built-in CRM/i);
  assert.equal(readLocalCrm(options).leads.length, 1);
});

test("the Zero client refuses an email path before any request", () => {
  assert.throws(() => assertZeroRecordPath("/api/sequences"), /records and drafts only/);
  assert.doesNotThrow(() => assertZeroRecordPath("/api/companies"));
  assert.doesNotThrow(() => assertZeroRecordPath("/api/notes"));
});
