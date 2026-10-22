import { draftSponsorAsk } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as { request_id?: string; sponsor_id?: string; sponsor_name?: string; headcount?: number; community?: string };
    const draft = await draftSponsorAsk(await readyDb(), body);
    return Response.json(draft);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not draft the email." }, { status: 400 });
  }
}
