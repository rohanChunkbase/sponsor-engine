import type { Db } from "@sponsor-engine/db";
import { draftSponsorAsk } from "./draft.js";
import { forecastTurnout } from "./forecast.js";
import { quoteBooking } from "./quote.js";
import { findSponsors } from "./sponsors.js";
import { triageInbound } from "./triage.js";

export const DEMO_MESSAGE = "Hi! Unicorn Mafia here, we want to run our next hackathon at Expedite London for ~120 hackers, a Saturday in late November, need the room 10:00-22:00 plus food.";

export async function runDemo(db: Db) {
  const triage = triageInbound(db, { message: DEMO_MESSAGE, channel: "whatsapp" });
  if (!triage.ok) {
    throw new Error(triage.failure?.message || "The demo message could not be read.");
  }
  const requestId = String(triage.request?.id);
  const forecast = forecastTurnout(db, {
    headcount: triage.qualified?.headcount ?? 120,
    requester_kind: "community",
    community_name: triage.qualified?.organisation ?? "Unicorn Mafia",
    request_id: requestId,
  });
  const quote = await quoteBooking(db, { request_id: requestId });
  const sponsors = await findSponsors(db, { request_id: requestId, limit: 3 });
  const draft = await draftSponsorAsk(db, {
    request_id: requestId,
    sponsor_id: sponsors.matches[0]?.sponsor_id,
    useTestInbox: true,
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
