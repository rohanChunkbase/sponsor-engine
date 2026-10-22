import { parseEmail, saveInbound } from "@sponsor-engine/channels/inbound";

export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  let raw = "";
  try {
    if (type.includes("application/json")) {
      const body = await request.json() as { eml?: unknown; text?: unknown };
      raw = typeof body.eml === "string" ? body.eml : typeof body.text === "string" ? body.text : "";
    } else {
      raw = await request.text();
    }
  } catch {
    return Response.json({ error: "The email could not be read." }, { status: 400 });
  }
  const messages = parseEmail(raw);
  if (!messages.length) return Response.json({ error: "The email has no text." }, { status: 400 });
  return Response.json(await saveInbound(messages));
}
