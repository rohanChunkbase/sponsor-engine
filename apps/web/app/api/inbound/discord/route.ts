import { discordPingReply, parseDiscordPayload, saveInbound, verifyDiscordRequest } from "@sponsor-engine/channels/inbound";

export async function POST(request: Request) {
  const raw = await request.text();
  const allowed = verifyDiscordRequest({
    rawBody: raw,
    signature: request.headers.get("x-signature-ed25519") ?? undefined,
    timestamp: request.headers.get("x-signature-timestamp") ?? undefined,
    publicKeyHex: process.env.DISCORD_PUBLIC_KEY,
  });
  if (!allowed) return Response.json({ error: "The Discord signature is wrong." }, { status: 401 });
  let body: unknown;
  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const ping = discordPingReply(body);
  if (ping) return Response.json(ping);
  return Response.json(await saveInbound(parseDiscordPayload(body)));
}
