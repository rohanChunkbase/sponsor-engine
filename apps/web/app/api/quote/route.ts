import { getReadyDb, quoteBooking } from "@sponsor-engine/core";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { request_id?: string; headcount?: number; requester_kind?: "community" | "company" | "unknown" };
    const quote = await quoteBooking(getReadyDb(), body);
    return Response.json(quote);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Could not make a quote." }, { status: 400 });
  }
}
