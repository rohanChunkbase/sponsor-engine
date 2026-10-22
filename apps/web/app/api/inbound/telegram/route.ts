import { parseTelegramUpdate, saveInbound, telegramSecretOk } from "@sponsor-engine/channels/inbound";
import { dbForRequest, limited } from "../../../../lib/api-write";

export async function POST(request: Request) {
  const blocked = limited(request);
  if (blocked) return blocked;
  if (!telegramSecretOk(request.headers.get("x-telegram-bot-api-secret-token") ?? undefined)) {
    return Response.json({ error: "The Telegram secret is wrong." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  return Response.json(await saveInbound(parseTelegramUpdate(body), dbForRequest(request)));
}
