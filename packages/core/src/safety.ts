/** Hosted demo. Dynamic lookup so a deploy can set this at runtime. */
export function isDemoMode(): boolean {
  const value = (process.env["DEMO_MODE"] ?? "").trim().toLowerCase();
  return value === "true" || value === "1" || value === "yes";
}

/** Test mode is the default. A hosted demo cannot leave it. */
export function isDryRun(): boolean {
  if (isDemoMode()) return true;
  const value = (process.env.DRY_RUN ?? "true").trim().toLowerCase();
  return value !== "false" && value !== "0" && value !== "no";
}

export function allowlist(): string[] {
  return (process.env.ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlisted(recipient: string): boolean {
  const email = recipient.trim().toLowerCase();
  return allowlist().includes(email);
}

/** Reject a browser approval that did not start on this site. */
export function assertDashboardOrigin(request: Request): void {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") {
    throw new Error("Approval has to come from this site.");
  }
  const origin = request.headers.get("origin");
  if (!origin) return;
  let originHost = "";
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new Error("Approval has to come from this site.");
  }
  const forwarded = request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
  const host = forwarded.split(",")[0]?.trim() ?? "";
  if (originHost !== host) {
    throw new Error("Approval has to come from this site.");
  }
}

export function safetySnapshot() {
  return {
    dry_run: isDryRun(),
    allowlist_count: allowlist().length,
    sends_email: false,
    sends_whatsapp: false,
  };
}
