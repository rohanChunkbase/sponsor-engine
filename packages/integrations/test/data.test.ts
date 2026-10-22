import assert from "node:assert/strict";
import test from "node:test";
import { companySize, devpostLondonHackathons, lumaEventHosts } from "../src/index.ts";
import { baseOptions, header } from "./helpers.ts";

const SEARCH_HTML = `
<li class="type-company">
  <h3><a class="govuk-link" href="/company/08778322" title="View company">CLOUDFLARE LIMITED</a></h3>
</li>`;

const PROFILE_HTML = `
<h1 class="heading-xlarge">CLOUDFLARE LIMITED</h1>
<dt>Company status</dt><dd id="company-status">Active</dd>
<dt>Incorporated on</dt><dd id="company-creation-date">18 November 2013</dd>
<span id="sic0">62012 - Business and domestic software development</span>
`;

test("live data falls back to the bundle when the network fails", async () => {
  const options = baseOptions();
  const luma = await lumaEventHosts("evt-SAMPLEE001", options);
  assert.equal(luma.mode, "builtin");
  assert.equal(luma.data.hosts[0]?.name, "Rhea Ostrander (fictional)");
  assert.match(luma.warning ?? "", /Bundled data/);

  const hackathons = await devpostLondonHackathons(options);
  assert.equal(hackathons.mode, "builtin");
  assert.ok(hackathons.data.some((row) => /hackathon/i.test(row.title)));

  const company = await companySize("Anthropic", options);
  assert.equal(company.mode, "builtin");
  assert.equal(company.data.via, "bundled-data");
  assert.equal(company.data.matchedName, "Anthropic");
  assert.match(company.data.sizeNote, /London events/);
});

test("Luma host JSON uses the public event payload shape", async () => {
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    assert.match(url, /api\.lu\.ma\/event\/get\?event_api_id=evt-TEST/);
    return new Response(
      JSON.stringify({
        api_id: "evt-TEST",
        guest_count: 40,
        event: { name: "Demo night", start_at: "2026-10-22T18:00:00.000Z" },
        calendar: { name: "Encode Club" },
        hosts: [
          {
            name: "Future Forward",
            linkedin_handle: "future",
            twitter_handle: "ff",
            website: "https://example.com",
            username: "futureforward",
          },
        ],
      }),
      { status: 200 },
    );
  };
  const result = await lumaEventHosts("evt-TEST", baseOptions({ fetchImpl }));
  assert.equal(result.mode, "live");
  assert.equal(result.provider, "luma");
  assert.equal(result.data.name, "Demo night");
  assert.equal(result.data.guestCount, 40);
  assert.equal(result.data.hosts[0]?.linkedinHandle, "future");
  assert.equal(result.data.calendarName, "Encode Club");
});

test("the public Companies House page supplies status, date, and SIC codes", async () => {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    assert.equal(header(init, "authorization"), null);
    if (url.includes("/search/companies")) return new Response(SEARCH_HTML, { status: 200 });
    return new Response(PROFILE_HTML, { status: 200 });
  };
  const result = await companySize("cloudflare", baseOptions({ fetchImpl }));
  assert.equal(result.mode, "live");
  assert.equal(result.data.via, "public-page");
  assert.equal(result.data.companyNumber, "08778322");
  assert.equal(result.data.status, "Active");
  assert.equal(result.data.incorporatedOn, "18 November 2013");
  assert.equal(result.data.sicCodes[0]?.code, "62012");
  assert.match(result.data.sicCodes[0]?.description ?? "", /software/i);
  assert.ok(urls.every((url) => url.includes("find-and-update.company-information.service.gov.uk")));
});

test("the official Companies House API is used when the key is set", async () => {
  const urls: string[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = String(input);
    urls.push(url);
    const token = header(init, "authorization") ?? "";
    assert.equal(Buffer.from(token.replace("Basic ", ""), "base64").toString("utf8"), "ch-key:");
    if (url.includes("/search/companies")) {
      return new Response(
        JSON.stringify({
          items: [
            {
              company_number: "08778322",
              title: "CLOUDFLARE LIMITED",
              company_status: "active",
              date_of_creation: "2013-11-18",
            },
          ],
        }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({
        company_name: "CLOUDFLARE LIMITED",
        company_number: "08778322",
        company_status: "active",
        date_of_creation: "2013-11-18",
        sic_codes: ["62012", "63110"],
        registered_office_address: { locality: "London", postal_code: "EC2A 2AP" },
      }),
      { status: 200 },
    );
  };
  const result = await companySize(
    "cloudflare",
    baseOptions({ env: { COMPANIES_HOUSE_API_KEY: "ch-key" }, fetchImpl }),
  );
  assert.equal(result.mode, "live");
  assert.equal(result.data.via, "official-api");
  assert.equal(result.data.status, "active");
  assert.deepEqual(
    result.data.sicCodes.map((code) => code.code),
    ["62012", "63110"],
  );
  assert.match(result.data.address ?? "", /London/);
  assert.ok(urls.every((url) => url.startsWith("https://api.company-information.service.gov.uk")));
});

test("Devpost JSON keeps the organiser and strips the prize HTML", async () => {
  const fetchImpl: typeof fetch = async () =>
    new Response(
      JSON.stringify({
        hackathons: [
          {
            id: 31330,
            title: "WORLDS London",
            url: "https://worlds.devpost.com/",
            displayed_location: { location: "London, Waterloo" },
            submission_period_dates: "Sep 12, 2026",
            open_state: "ended",
            organization_name: "Multic",
            registrations_count: 59,
            prize_amount: "£<span data-currency-value>1,000</span>",
            themes: [{ name: "Machine Learning/AI" }],
          },
        ],
        meta: { total_count: 1 },
      }),
      { status: 200 },
    );
  const result = await devpostLondonHackathons(baseOptions({ fetchImpl }));
  assert.equal(result.mode, "live");
  assert.equal(result.data[0]?.organizationName, "Multic");
  assert.equal(result.data[0]?.prizeAmount, "£ 1,000");
  assert.deepEqual(result.data[0]?.themes, ["Machine Learning/AI"]);
  assert.equal(result.data.length, 1);
});
