import { askRaft } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => ({}))) as { message?: string };
  const message = body.message?.trim();
  if (!message) return Response.json({ error: "Paste a message first." }, { status: 400 });
  try {
    const result = await askRaft(await readyDb(), { message, channel: "dashboard" });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Raft could not finish this message." }, { status: 400 });
  }
}
