import { getReadyDb } from "@sponsor-engine/core";
import { acceptAll, type InboundReceipt } from "./accept.js";
import type { InboundMessage } from "./types.js";

export { acceptAll, acceptInbound } from "./accept.js";
export type { InboundReceipt } from "./accept.js";
export { parseJsonInbound } from "./adapters/json.js";
export { parseWhatsAppExport } from "./adapters/whatsapp.js";
export { parseWhatsAppCloud, whatsAppChallenge } from "./adapters/whatsapp-cloud.js";
export { discordPingReply, parseDiscordPayload, verifyDiscordRequest } from "./adapters/discord.js";
export { parseTelegramUpdate, telegramSecretOk } from "./adapters/telegram.js";
export { parseEmail } from "./adapters/email.js";
export { parseSlackEvent, slackSignatureOk, slackUrlChallenge } from "./adapters/slack.js";

/** Save messages and keep every reply in the outbox. An empty list is not an error. */
export async function saveInbound(messages: InboundMessage[]) {
  if (!messages.length) {
    return { ok: true as const, sent: false as const, count: 0, truncated: false, results: [] as InboundReceipt[] };
  }
  const batch = await acceptAll(getReadyDb(), messages);
  return {
    ok: true as const,
    sent: false as const,
    count: batch.results.length,
    truncated: batch.truncated,
    results: batch.results,
  };
}
