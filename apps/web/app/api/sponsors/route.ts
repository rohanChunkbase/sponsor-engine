import { findSponsors } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { request_id?: string; headcount?: number; needs?: string[]; focus?: string };
  try {
    const result = await findSponsors(await readyDb(), {
      request_id: body.request_id ?? null,
      headcount: body.headcount ?? (body.request_id ? null : 100),
      needs: body.needs ?? (body.request_id ? null : ["food"]),
      focus: body.focus ?? (body.request_id ? null : "hackathon"),
      limit: 3,
      log: false,
    });
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not match sponsors." }, { status: 400 });
  }
}
