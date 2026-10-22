import { getReadyDb, runDemo } from "@sponsor-engine/core";

export async function POST() {
  try {
    return Response.json(await runDemo(getReadyDb()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The demo could not run." }, { status: 400 });
  }
}
