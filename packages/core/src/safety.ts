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

/** Placeholder inbox for sponsor drafts. It is not a person's address and not a sponsor inbox. */
export const TEST_INBOX = "sponsors@example.com";

export function allowlist(): string[] {
  const listed = (process.env.ALLOWLIST ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (!listed.includes(TEST_INBOX)) listed.push(TEST_INBOX);
  return listed;
}

export function isAllowlisted(recipient: string): boolean {
  const email = recipient.trim().toLowerCase();
  if (allowlist().includes(email)) return true;
  const [local, domain] = email.split("@");
  if (!local || !domain) return false;
  const base = local.split("+")[0];
  return allowlist().includes(`${base}@${domain}`);
}

/** A placeholder at the test inbox. The company name is only the tag. */
export function placeholderAtTestInbox(company: string): string {
  const tag = company.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "sponsor";
  return `sponsors+${tag}@example.com`;
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
