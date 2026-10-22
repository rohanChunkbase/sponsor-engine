import { parseWhatsAppCloud, parseWhatsAppExport, saveInbound, whatsAppChallenge } from "@sponsor-engine/channels/inbound";

export async function GET(request: Request) {
  const challenge = whatsAppChallenge(new URL(request.url).searchParams);
  if (!challenge) return Response.json({ error: "The WhatsApp check did not pass." }, { status: 403 });
  return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
}

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Expected JSON." }, { status: 400 });
    }
    const record = body && typeof body === "object" ? body as Record<string, unknown> : null;
    if (record?.object === "whatsapp_business_account") return Response.json(await saveInbound(parseWhatsAppCloud(body)));
    const text = typeof record?.text === "string" ? record.text : typeof record?.export === "string" ? record.export : "";
    if (!text.trim()) return Response.json({ error: "Send a Cloud API payload or a chat export." }, { status: 400 });
    const messages = parseWhatsAppExport(text);
    if (!messages.length) return Response.json({ error: "The export has no messages." }, { status: 400 });
    return Response.json(await saveInbound(messages));
  }
  const messages = parseWhatsAppExport(await request.text());
  if (!messages.length) return Response.json({ error: "The export has no messages." }, { status: 400 });
  return Response.json(await saveInbound(messages));
}
