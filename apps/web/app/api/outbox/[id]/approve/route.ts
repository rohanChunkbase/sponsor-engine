import { approveOutbox, assertDashboardOrigin, getReadyDb } from "@sponsor-engine/core";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    assertDashboardOrigin(request);
    const body = (await request.json().catch(() => ({}))) as { actor?: string };
    return Response.json(await approveOutbox(getReadyDb(), id, body.actor || "dashboard"));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not approve." }, { status: 400 });
  }
}
