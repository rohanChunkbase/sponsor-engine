import { quoteBooking } from "@sponsor-engine/core";
import { limited, readyDb } from "@/lib/request";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  try {
    const body = (await request.json()) as { request_id?: string; headcount?: number; requester_kind?: "community" | "company" | "unknown" };
    const quote = await quoteBooking(await readyDb(), body);
    return Response.json(quote);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not make a quote." }, { status: 400 });
  }
}
