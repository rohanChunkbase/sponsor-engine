import { getReadyDb, triageInbound } from "@sponsor-engine/core";

export async function POST(request: Request) {
  const body = (await request.json()) as { message?: string; channel?: string; sender_name?: string };
  if (!body.message?.trim()) return Response.json({ error: "Paste a message first." }, { status: 400 });
  return Response.json(triageInbound(getReadyDb(), { message: body.message, channel: body.channel, sender_name: body.sender_name }));
}
