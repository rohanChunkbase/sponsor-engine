import { parseTelegramUpdate, saveInbound, telegramSecretOk } from "@sponsor-engine/channels/inbound";

export async function POST(request: Request) {
  if (!telegramSecretOk(request.headers.get("x-telegram-bot-api-secret-token") ?? undefined)) {
    return Response.json({ error: "The Telegram secret is wrong." }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  return Response.json(await saveInbound(parseTelegramUpdate(body)));
}
