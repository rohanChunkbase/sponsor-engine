import { handleMcpRequest } from "@sponsor-engine/mcp/web";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function GET(request: Request) {
  return handleMcpRequest(request);
}

export function POST(request: Request) {
  return handleMcpRequest(request);
}

export function DELETE(request: Request) {
  return handleMcpRequest(request);
}
