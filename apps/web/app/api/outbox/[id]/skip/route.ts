import { skipOutbox } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = limited(request);
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const body = (await request.json().catch(() => ({}))) as { actor?: string };
    return Response.json(skipOutbox(await readyDb(), id, body.actor || "dashboard"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not skip." }, { status: 400 });
  }
}
