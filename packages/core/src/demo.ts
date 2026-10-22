import type { Db } from "@sponsor-engine/db";
import { draftSponsorAsk } from "./draft.js";
import { forecastTurnout } from "./forecast.js";
import { quoteBooking } from "./quote.js";
import { findSponsors } from "./sponsors.js";
import { triageInbound } from "./triage.js";

export const DEMO_MESSAGE = [
  "Hi, this is Ada Fernwood from Thames Agent Builders (SAMPLE).",
  "Can we book Expedite at Lyric Square for an evening meetup on Thursday 26 November?",
  "About 80 people from the community.",
  "We need the room from 18:00, pizza or similar, and a projector.",
  "It is a free community night, not a company offsite.",
].join(" ");

export async function runDemo(db: Db) {
  const triage = triageInbound(db, { message: DEMO_MESSAGE, channel: "whatsapp" });
  if (!triage.ok) {
    throw new Error(triage.failure?.message || "The demo message could not be read.");
  }
  const requestId = String(triage.request?.id);
  const forecast = forecastTurnout(db, {
    headcount: 80,
    requester_kind: "community",
    community_name: "Thames Agent Builders (SAMPLE)",
    request_id: requestId,
  });
  const quote = await quoteBooking(db, { request_id: requestId });
  const sponsors = await findSponsors(db, { request_id: requestId, limit: 3 });
  const draft = await draftSponsorAsk(db, {
    request_id: requestId,
    sponsor_id: sponsors.matches[0]?.sponsor_id,
  });
  return {
    request_id: requestId,
    triage,
    forecast,
    quote,
    sponsors,
    draft,
    outbox_id: draft.outbox.id,
    chat_outbox_id: triage.outbox?.id ?? null,
  };
}
