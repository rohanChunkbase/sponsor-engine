/** Test mode is the default. A false value is the only way to leave it. */
export function isDryRun(): boolean {
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

export function safetySnapshot() {
  return {
    dry_run: isDryRun(),
    allowlist_count: allowlist().length,
    sends_email: false,
    sends_whatsapp: false,
  };
}
