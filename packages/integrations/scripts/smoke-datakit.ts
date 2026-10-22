import { isLikelySpam, sponsorMatchReport, createRegistry } from "../src/index.ts";

const registry = createRegistry();
const london = await registry.data.londonEventsIndex();
const leads = await registry.data.organiserLeads();
const requester = await registry.data.verifyRequester("octocat");
const spam = isLikelySpam("URGENT! You have won a free prize. Call now to claim your reward.");
const ham = isLikelySpam("See you at the meetup tomorrow near the station.");
const report = sponsorMatchReport();

console.log(
  JSON.stringify(
    {
      script: "smoke-datakit",
      london: {
        mode: london.mode,
        provider: london.provider,
        events: london.data.events.length,
        venues: london.data.venues.length,
        calendars: london.data.calendars.length,
        sources: london.data.sources.map((source) => ({
          id: source.id,
          mode: source.mode,
          events: source.events.length,
          warning: source.warning ?? null,
        })),
        warning: london.warning ?? null,
      },
      organisers: {
        mode: leads.mode,
        provider: leads.provider,
        count: leads.data.leads.length,
        sources: leads.data.sources,
        warning: leads.warning ?? null,
      },
      verifyRequester: {
        mode: requester.mode,
        provider: requester.provider,
        handle: requester.data.handle,
        realBuilder: requester.data.realBuilder,
        score: requester.data.score,
        github: requester.data.github,
        devpostProjects: requester.data.devpostProjects.length,
        hackerNews: requester.data.hackerNews.length,
        warning: requester.warning ?? null,
      },
      spam: { spam: spam.spam, score: spam.score, reasons: spam.reasons },
      ham: { spam: ham.spam, score: ham.score },
      sponsorMatch: report,
    },
    null,
    2,
  ),
);
