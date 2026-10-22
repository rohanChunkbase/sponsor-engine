import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { chooseWorkspaceId } from "@/lib/workspace-id";

export function middleware(request: NextRequest) {
  const existing = request.cookies.get("se_workspace")?.value;
  const id = chooseWorkspaceId(existing, request.headers.get("x-workspace-id") ?? undefined);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-workspace-id", id);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (existing !== id) {
    response.cookies.set("se_workspace", id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
