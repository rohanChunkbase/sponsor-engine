import { undoAsk } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  const body = (await request.json().catch(() => ({}))) as { outbox_ids?: string[] };
  const ids = Array.isArray(body.outbox_ids) ? body.outbox_ids.filter((id) => typeof id === "string") : [];
  if (!ids.length) return Response.json({ error: "Nothing to undo." }, { status: 400 });
  try {
    return Response.json(undoAsk(await readyDb(), ids));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not undo." }, { status: 400 });
  }
}
