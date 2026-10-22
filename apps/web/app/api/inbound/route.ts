import { parseJsonInbound, saveInbound } from "@sponsor-engine/channels/inbound";
import { dbForRequest, limited } from "../../../lib/api-write";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const messages = parseJsonInbound(body);
  if (!messages.length) return Response.json({ error: "Send channel, from, and text." }, { status: 400 });
  return Response.json(await saveInbound(messages, dbForRequest(request)));
}
