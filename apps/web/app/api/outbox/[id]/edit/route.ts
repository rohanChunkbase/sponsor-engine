import { editOutbox } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const blocked = limited(request);
  if (blocked) return blocked;
  const { id } = await context.params;
  try {
    const body = (await request.json()) as { body?: string; subject?: string; actor?: string };
    return Response.json(editOutbox(await readyDb(), id, body));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not save the edit." }, { status: 400 });
  }
}
