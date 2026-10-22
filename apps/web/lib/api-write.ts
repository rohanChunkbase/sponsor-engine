import { allowWrite, getReadyDb, isDemoMode } from "@sponsor-engine/core";
import { enterWorkspace, type Db } from "@sponsor-engine/db";

export function limited(request: Request): Response | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded
    ? forwarded.split(",")[0]?.trim() || "unknown"
    : request.headers.get("x-real-ip")?.trim() || "unknown";
  const result = allowWrite(ip);
  if (result.ok) return null;
  return Response.json(
    { error: "Too many requests. Wait a minute and try again." },
    { status: 429, headers: { "retry-after": String(result.retryAfter) } },
  );
}

/** Use the visitor workspace in demo mode. The header comes from the request. */
export function dbForRequest(request: Request): Db {
  if (isDemoMode()) {
    const id = request.headers.get("x-workspace-id")?.trim() ?? "";
    if (/^[A-Za-z0-9_-]{8,80}$/.test(id)) enterWorkspace(id);
  }
  return getReadyDb();
}
