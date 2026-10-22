import { draftSponsorAsk, findSponsors, quoteBooking, triageInbound } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "Paste a message first." }, { status: 400 });
  try {
    const db = await readyDb();
    const triage = await triageInbound(db, { message, channel: "dashboard" });
    if (!triage.ok) return Response.json({ triage });
    const requestId = String(triage.request?.id);
    const quote = triage.qualified?.headcount
      ? await quoteBooking(db, { request_id: requestId }).catch((error: unknown) => ({ error: errorText(error) }))
      : null;
    const sponsors = await findSponsors(db, { request_id: requestId, limit: 3 });
    const sponsorId = sponsors.matches[0]?.sponsor_id;
    const missing = [
      triage.qualified?.event_date ? null : "date",
      triage.qualified?.needs?.length ? null : "needs",
      triage.qualified?.headcount ? null : "headcount",
    ].filter((item): item is string => Boolean(item));
    const draft = sponsorId && missing.length === 0
      ? await draftSponsorAsk(db, { request_id: requestId, sponsor_id: sponsorId, useTestInbox: true }).catch((error: unknown) => ({ error: errorText(error) }))
      : null;
    return Response.json({ request_id: requestId, triage, quote, sponsors, draft, missing });
  } catch (error) {
    return Response.json({ error: errorText(error) }, { status: 400 });
  }
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Raft could not finish this message.";
}
