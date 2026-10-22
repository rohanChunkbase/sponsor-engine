export function money(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function priorityLabel(priority: string | null | undefined): string {
  if (priority === "p0") return "High";
  if (priority === "p1") return "Soon";
  return "Normal";
}

export function kindLabel(kind: string | null | undefined): string {
  if (kind === "company") return "Company";
  if (kind === "community") return "Community";
  return "Not sure";
}

export function waitingLabel(status: string, reason?: string | null): string {
  if (status === "needs_contact") return "Find a contact";
  if (status === "awaiting_approval" || status === "draft") return "Waiting for you";
  if (status === "approved") return "Approved";
  if (status === "sent") return "Sent";
  if (status === "blocked") return reason?.toLowerCase().includes("skip") ? "Skipped" : "Not sent";
  if (status === "failed") return "Needs a person";
  if (status === "triaged" || status === "open") return "Open";
  return status;
}

export function toolLabel(tool: string): string {
  const names: Record<string, string> = {
    triage_inbound: "Read a message",
    quote_booking: "Made a quote",
    find_sponsors: "Matched sponsors",
    forecast_turnout: "Estimated turnout",
    draft_sponsor_ask: "Wrote a sponsor email",
    send_with_approval: "Queued a message",
    approve: "Approved",
    skip: "Skipped",
    edit: "Edited",
    recall_history: "Looked up history",
    list_failures: "Checked failures",
  };
  return names[tool] ?? tool;
}

export function kindOfMessage(kind: string): string {
  if (kind === "chat_reply") return "Reply";
  if (kind === "sponsor_email") return "Sponsor email";
  return "Message";
}
