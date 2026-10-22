import { editOutbox, sendWithApproval, triageInbound } from "@sponsor-engine/core";
import type { Db } from "@sponsor-engine/db";
import { draftReply } from "./llm.js";
import type { InboundMessage } from "./types.js";

export type InboundReceipt = {
  inbound: InboundMessage;
  ok: boolean;
  sent: false;
  outbox: { id: string; status: string; body: string } | null;
};

export type AcceptOptions = {
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
};

/**
 * Record one message with triage_inbound.
 * The reply is an outbox draft. This function does not send it.
 * A model rewrites the draft only when LLM_BASE_URL and LLM_MODEL are set.
 */
export async function acceptInbound(db: Db, inbound: InboundMessage, options?: AcceptOptions): Promise<InboundReceipt> {
  const text = inbound.text.trim();
  if (!text) return { inbound, ok: false, sent: false, outbox: null };

  const result = triageInbound(db, {
    message: text,
    channel: inbound.channel,
    sender_name: inbound.from,
  });

  if (result.ok && result.outbox) {
    return finish(db, inbound, true, {
      id: String(result.outbox.id),
      status: String(result.outbox.status),
      body: String(result.outbox.body),
    }, options);
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
  return finish(db, inbound, false, { id: queued.item.id, status: queued.item.status, body: queued.item.body }, options);
}

async function finish(
  db: Db,
  inbound: InboundMessage,
  ok: boolean,
  outbox: { id: string; status: string; body: string },
  options?: AcceptOptions,
): Promise<InboundReceipt> {
  const rewritten = await draftReply({
    inbound,
    ruleReply: outbox.body,
    env: options?.env ?? process.env,
    fetchImpl: options?.fetchImpl,
  });
  if (!rewritten || rewritten === outbox.body) return { inbound, ok, sent: false, outbox };
  const edited = editOutbox(db, outbox.id, { body: rewritten, actor: "llm" });
  return {
    inbound,
    ok,
    sent: false,
    outbox: { id: edited.item.id, status: edited.item.status, body: edited.item.body },
  };
}

/** Triage many messages. Extra messages above the limit are not saved. */
export async function acceptAll(db: Db, messages: InboundMessage[], limit = 500) {
  const slice = messages.slice(0, Math.max(0, limit));
  const results: InboundReceipt[] = [];
  for (const message of slice) results.push(await acceptInbound(db, message));
  return { results, truncated: messages.length > slice.length, sent: false as const };
}
