import { triageInbound } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  const body = (await request.json()) as { message?: string; channel?: string; sender_name?: string };
  if (!body.message?.trim()) return Response.json({ error: "Paste a message first." }, { status: 400 });
  return Response.json(await triageInbound(await readyDb(), { message: body.message, channel: body.channel, sender_name: body.sender_name }));
}
