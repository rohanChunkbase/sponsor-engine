import { listRuns } from "@sponsor-engine/core";
import { readyDb } from "@/lib/request";

export async function GET() {
  return Response.json(listRuns(await readyDb(), 40));
}
