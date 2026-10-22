import type { Db } from "@sponsor-engine/db";
import { draftSponsorAsk } from "./draft.js";
import { listFailures } from "./failures.js";
import { forecastTurnout } from "./forecast.js";
import { skipOutbox } from "./outbox.js";
import { quoteBooking } from "./quote.js";
import { recallHistory } from "./recall.js";
import { sendWithApproval } from "./outbox.js";
import { findSponsors } from "./sponsors.js";
import { triageInbound } from "./triage.js";

export const ASK_TOOLS = [
  "triage_inbound",
  "quote_booking",
  "find_sponsors",
  "forecast_turnout",
  "draft_sponsor_ask",
  "send_with_approval",
  "list_failures",
  "recall_history",
] as const;

export type AskToolName = (typeof ASK_TOOLS)[number];

export type AskStep = { tool: AskToolName; title: string };

const TITLES: Record<AskToolName, string> = {
  triage_inbound: "Read the message",
  quote_booking: "Price the room",
  find_sponsors: "Match sponsors",
  forecast_turnout: "Forecast turnout",
  draft_sponsor_ask: "Draft a sponsor email",
  send_with_approval: "Queue for approval",
  list_failures: "Show unread messages",
  recall_history: "Look up history",
};

export function planAsk(message: string): { steps: AskStep[] } {
  const text = message.trim().toLowerCase();
  if (!text) return { steps: [] };
  if (/^(show |list )?(drafts|failures|unread)/.test(text) || text.includes("could not read")) {
    return { steps: [{ tool: "list_failures", title: TITLES.list_failures }] };
  }
  if (text.startsWith("recall ") || text.startsWith("look up ") || text.startsWith("history ")) {
    return { steps: [{ tool: "recall_history", title: TITLES.recall_history }] };
  }
  if (/\b(sponsor|who might pay|food sponsor)\b/.test(text) && !looksLikeInbound(text)) {
    return { steps: [{ tool: "find_sponsors", title: TITLES.find_sponsors }] };
  }
  return {
    steps: [
      { tool: "triage_inbound", title: TITLES.triage_inbound },
      { tool: "quote_booking", title: TITLES.quote_booking },
      { tool: "find_sponsors", title: TITLES.find_sponsors },
      { tool: "draft_sponsor_ask", title: TITLES.draft_sponsor_ask },
    ],
  };
}

function looksLikeInbound(text: string): boolean {
  return /\b(people|hackathon|booking|room|event|whatsapp)\b/.test(text) || text.length > 80;
}

export async function runAskTool(db: Db, name: string, args: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "triage_inbound":
      return triageInbound(db, {
        message: String(args.message ?? ""),
        channel: args.channel ? String(args.channel) : undefined,
        sender_name: args.sender_name ? String(args.sender_name) : undefined,
      });
    case "quote_booking":
      return quoteBooking(db, args as Parameters<typeof quoteBooking>[1]);
    case "find_sponsors":
      return findSponsors(db, args as Parameters<typeof findSponsors>[1]);
    case "forecast_turnout":
      return forecastTurnout(db, args as Parameters<typeof forecastTurnout>[1]);
    case "draft_sponsor_ask":
      return draftSponsorAsk(db, args as Parameters<typeof draftSponsorAsk>[1]);
    case "send_with_approval":
      return sendWithApproval(db, {
        recipient: String(args.recipient ?? ""),
        subject: String(args.subject ?? ""),
        body: String(args.body ?? ""),
        kind: args.kind ? String(args.kind) : undefined,
        requestId: args.request_id ? String(args.request_id) : undefined,
        sponsorId: args.sponsor_id ? String(args.sponsor_id) : undefined,
        sponsorName: args.sponsor_name ? String(args.sponsor_name) : undefined,
        askGbp: typeof args.ask_gbp === "number" ? args.ask_gbp : undefined,
      });
    case "list_failures":
      return listFailures(db, typeof args.limit === "number" ? args.limit : 20);
    case "recall_history":
      return recallHistory(db, String(args.query ?? args.message ?? ""));
    default:
      throw new Error(`Unknown tool ${name}.`);
  }
}

export async function askRaft(
  db: Db,
  input: { message: string; channel?: string; sender_name?: string },
) {
  const message = input.message.trim();
  const plan = planAsk(message);
  const first = plan.steps[0]?.tool;

  if (first === "list_failures") {
    const failures = await runAskTool(db, "list_failures", { limit: 12 });
    return { plan, tool: first, failures, undo: { outbox_ids: [] as string[] } };
  }
  if (first === "recall_history") {
    const recall = await runAskTool(db, "recall_history", { query: message.replace(/^(recall|look up|history)\s+/i, "") });
    return { plan, tool: first, recall, undo: { outbox_ids: [] as string[] } };
  }
  if (first === "find_sponsors" && plan.steps.length === 1) {
    const sponsors = await findSponsors(db, { community: message, limit: 3 });
    return { plan, tool: first, sponsors, undo: { outbox_ids: [] as string[] } };
  }

  const triage = await triageInbound(db, {
    message,
    channel: input.channel ?? "dashboard",
    sender_name: input.sender_name,
  });
  if (!triage.ok) return { plan, triage, undo: { outbox_ids: [] as string[] } };

  const requestId = String(triage.request?.id);
  const quote = triage.qualified?.headcount
    ? await quoteBooking(db, { request_id: requestId }).catch((error: unknown) => ({ error: errorText(error) }))
    : null;
  const sponsors = await findSponsors(db, { request_id: requestId, limit: 3 });
  const sponsorId = sponsors.matches[0]?.sponsor_id;
  const draft =
    sponsorId && triage.qualified?.headcount
      ? await draftSponsorAsk(db, { request_id: requestId, sponsor_id: sponsorId, useTestInbox: true }).catch((error: unknown) => ({
          error: errorText(error),
        }))
      : null;
  const outboxIds = [
    triage.outbox && typeof triage.outbox === "object" && "id" in triage.outbox ? String((triage.outbox as { id: string }).id) : null,
    draft && typeof draft === "object" && draft !== null && "outbox" in draft && (draft as { outbox?: { id?: string } }).outbox?.id
      ? String((draft as { outbox: { id: string } }).outbox.id)
      : null,
  ].filter((id): id is string => Boolean(id));

  return {
    plan,
    request_id: requestId,
    triage,
    quote,
    sponsors,
    draft,
    undo: { outbox_ids: outboxIds },
  };
}

export function undoAsk(db: Db, outboxIds: string[], actor = "dashboard") {
  const skipped: string[] = [];
  const errors: string[] = [];
  for (const id of outboxIds) {
    try {
      skipOutbox(db, id, actor);
      skipped.push(id);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  return { skipped, errors };
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Raft could not finish this message.";
}
