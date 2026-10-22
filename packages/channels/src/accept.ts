import { sendWithApproval, triageInbound } from "@sponsor-engine/core";
import type { Db } from "@sponsor-engine/db";
import type { InboundMessage } from "./types.js";

export type InboundReceipt = {
  inbound: InboundMessage;
  ok: boolean;
  sent: false;
  outbox: { id: string; status: string; body: string } | null;
};

/**
 * Record one message with triage_inbound.
 * The reply is an outbox draft. This function does not send it.
 */
export async function acceptInbound(db: Db, inbound: InboundMessage): Promise<InboundReceipt> {
  const text = inbound.text.trim();
  if (!text) return { inbound, ok: false, sent: false, outbox: null };

  const result = triageInbound(db, {
    message: text,
    channel: inbound.channel,
    sender_name: inbound.from,
  });

  if (result.ok && result.outbox) {
    return {
      inbound,
      ok: true,
      sent: false,
      outbox: {
        id: String(result.outbox.id),
        status: String(result.outbox.status),
        body: String(result.outbox.body),
      },
    };
  }

  const reply = result.suggested_reply?.trim();
  if (!reply) return { inbound, ok: false, sent: false, outbox: null };
  const requestId = typeof result.request?.id === "string" ? result.request.id : null;
  const queued = sendWithApproval(db, {
    kind: "chat_reply",
    recipient: inbound.from || "In the chat",
    subject: `Reply to ${inbound.from || "the message"}`,
    body: reply,
    requestId,
  });
  return {
    inbound,
    ok: false,
    sent: false,
    outbox: { id: queued.item.id, status: queued.item.status, body: queued.item.body },
  };
}

/** Triage many messages. Extra messages above the limit are not saved. */
export async function acceptAll(db: Db, messages: InboundMessage[], limit = 500) {
  const slice = messages.slice(0, Math.max(0, limit));
  const results: InboundReceipt[] = [];
  for (const message of slice) results.push(await acceptInbound(db, message));
  return { results, truncated: messages.length > slice.length, sent: false as const };
}
