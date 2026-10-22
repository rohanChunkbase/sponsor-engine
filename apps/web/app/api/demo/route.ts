import { runDemo } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  try {
    return Response.json(await runDemo(await readyDb()));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "The demo could not run." }, { status: 400 });
  }
}
