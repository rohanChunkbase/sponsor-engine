import { getReadyDb, skipOutbox } from "@sponsor-engine/core";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await _request.json().catch(() => ({}))) as { actor?: string };
    return Response.json(skipOutbox(getReadyDb(), id, body.actor || "dashboard"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not skip." }, { status: 400 });
  }
}
