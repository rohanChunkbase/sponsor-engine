import { parseSlackEvent, saveInbound, slackSignatureOk, slackUrlChallenge } from "@sponsor-engine/channels/inbound";
import { dbForRequest, limited } from "../../../../lib/api-write";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  const raw = await request.text();
  const allowed = slackSignatureOk({
    rawBody: raw,
    timestamp: request.headers.get("x-slack-request-timestamp") ?? undefined,
    signature: request.headers.get("x-slack-signature") ?? undefined,
    signingSecret: process.env.SLACK_SIGNING_SECRET,
  });
  if (!allowed) return Response.json({ error: "The Slack signature is wrong." }, { status: 401 });
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const challenge = slackUrlChallenge(body);
  if (challenge) return Response.json({ challenge });
  return Response.json(await saveInbound(parseSlackEvent(body), dbForRequest(request)));
}
