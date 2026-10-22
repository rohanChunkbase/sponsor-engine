import { getReadyDb, mapPoints } from "@sponsor-engine/core";

export function GET() {
  return Response.json(mapPoints(getReadyDb()));
}
