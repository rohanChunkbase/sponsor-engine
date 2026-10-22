import { getReadyDb, listRuns } from "@sponsor-engine/core";

export function GET() {
  return Response.json(listRuns(getReadyDb(), 40));
}
