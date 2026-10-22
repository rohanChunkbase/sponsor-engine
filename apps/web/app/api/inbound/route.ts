import { parseJsonInbound, saveInbound } from "@sponsor-engine/channels/inbound";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const messages = parseJsonInbound(body);
  if (!messages.length) return Response.json({ error: "Send channel, from, and text." }, { status: 400 });
  return Response.json(await saveInbound(messages));
}
