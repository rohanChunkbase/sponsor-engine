import { editOutbox, getReadyDb } from "@sponsor-engine/core";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { body?: string; subject?: string; actor?: string };
    return Response.json(editOutbox(getReadyDb(), id, body));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the edit." }, { status: 400 });
  }
}
