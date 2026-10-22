import { mapPoints } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export async function GET() {
  return Response.json(mapPoints(await readyDb()));
}
