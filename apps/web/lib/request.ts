import { headers } from "next/headers";
import { allowWrite, getReadyDb, isDemoMode } from "@sponsor-engine/core";
import { enterWorkspace, type Db } from "@sponsor-engine/db";

export async function readyDb(): Promise<Db> {
  if (isDemoMode()) {
    const incoming = await headers();
    const id = incoming.get("x-workspace-id")?.trim() ?? "";
    if (/^[A-Za-z0-9_-]{8,80}$/.test(id)) enterWorkspace(id);
  }
  return getReadyDb();
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function limited(request: Request): Response | null {
  const result = allowWrite(clientIp(request));
  if (result.ok) return null;
  return Response.json(
    { error: "Too many requests. Wait a minute and try again." },
    { status: 429, headers: { "retry-after": String(result.retryAfter) } },
  );
}
