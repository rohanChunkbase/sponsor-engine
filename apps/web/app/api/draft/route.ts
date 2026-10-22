import { draftSponsorAsk, getReadyDb } from "@sponsor-engine/core";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { request_id?: string; sponsor_id?: string };
    const draft = await draftSponsorAsk(getReadyDb(), body);
    return Response.json(draft);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not write the email." }, { status: 400 });
  }
}
