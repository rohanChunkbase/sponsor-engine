import type { Db } from "@sponsor-engine/db";
import { sendWithApproval } from "./outbox.js";
import { recordFailure, recordRun } from "./runs.js";
import type { RequesterKind } from "./types.js";
import { makeId, nowIso } from "./util.js";

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11,
  dec: 12, december: 12,
};

const PLACES = ["Lyric Square", "Expedite", "Encode Hub", "Shoreditch", "Old Street", "King's Cross", "Kings Cross", "London Bridge"];

export type TriageInput = {
  message: string;
  channel?: string;
  sender_name?: string;
};

export function triageInbound(db: Db, input: TriageInput) {
  const message = (input.message ?? "").trim();
  const channel = input.channel?.trim() || "web";
  const sender = parseSender(message, input.sender_name);
  const organisation = parseOrganisation(message);
  const eventDate = parseDate(message);
  const headcount = parseHeadcount(message);
  const needs = parseNeeds(message);
  const kind = parseKind(message);
  const venue = parseVenue(message);
  const intent = /\b(book|booking|hire|quote|reserve|host)\b/i.test(message);
  const parsed = message.length >= 12 && Boolean(headcount || eventDate) && (intent || kind !== "unknown" || Boolean(organisation));

  const requestId = makeId("req");
  const taskId = makeId("task");
  const created = nowIso();

  if (!parsed) {
    const reason = message.length < 12
      ? "The message is too short to qualify."
      : "The message has no date and no headcount.";
    const reply = "I could not qualify that message. Send the date, the number of people, and say if this is a community or a company. A person will read it.";
    db.run(
      `INSERT INTO requests
        (id, channel, raw_message, sender_name, organisation, requester_kind, event_date, headcount, needs_json, venue_hint, status, suggested_reply, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'failed', ?, ?)`,
      [requestId, channel, message, sender, organisation, kind, eventDate, headcount, JSON.stringify(needs), venue, reply, created],
    );
    db.run(
      `INSERT INTO tasks (id, request_id, title, owner, priority, status, created_at)
       VALUES (?, ?, ?, 'Front desk', 'p2', 'open', ?)`,
      [taskId, requestId, "Unparsed inbound — needs a person", created],
    );
    const failureId = recordFailure(db, {
      tool: "triage_inbound",
      message: reason,
      rawInput: message,
      requestId,
    });
    recordRun(db, {
      tool: "triage_inbound",
      inputSummary: clipInput(message),
      outputSummary: `Failed. ${reason}`,
      status: "error",
      requestId,
    });
    return {
      ok: false as const,
      failure: { id: failureId, message: reason },
      request: loadRequest(db, requestId),
      task: loadTask(db, taskId),
      suggested_reply: reply,
    };
  }

  const owner = kind === "company" ? "Commercial lead" : "Venue lead";
  const priority = priorityFor(kind, headcount, eventDate);
  const title = taskTitle({ organisation, headcount, kind, venue });
  const reply = replyFor({ sender, organisation, kind, eventDate, headcount, needs });

  db.run(
    `INSERT INTO requests
      (id, channel, raw_message, sender_name, organisation, requester_kind, event_date, headcount, needs_json, venue_hint, status, suggested_reply, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'triaged', ?, ?)`,
    [requestId, channel, message, sender, organisation, kind, eventDate, headcount, JSON.stringify(needs), venue, reply, created],
  );
  db.run(
    `INSERT INTO tasks (id, request_id, title, owner, priority, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`,
    [taskId, requestId, title, owner, priority, created],
  );
  const replyItem = sendWithApproval(db, {
    kind: "chat_reply",
    recipient: "In the chat",
    subject: `Reply to ${organisation || sender || "the message"}`,
    body: reply,
    requestId,
  });
  recordRun(db, {
    tool: "triage_inbound",
    inputSummary: clipInput(message),
    outputSummary: `${kind} · ${headcount ?? "?"} people · ${eventDate ?? "no date"} · ${owner} ${priority}`,
    requestId,
  });

  return {
    ok: true as const,
    request: loadRequest(db, requestId),
    task: loadTask(db, taskId),
    outbox: replyItem.item,
    qualified: {
      sender_name: sender,
      organisation,
      requester_kind: kind,
      event_date: eventDate,
      headcount,
      needs,
      venue_hint: venue,
      owner,
      priority,
    },
    suggested_reply: reply,
  };
}

function priorityFor(kind: RequesterKind, headcount: number | null, date: string | null): "p0" | "p1" | "p2" {
  if (kind === "company" || (headcount != null && headcount >= 100)) return "p0";
  if (date) {
    const days = (Date.parse(`${date}T00:00:00Z`) - Date.now()) / 86_400_000;
    if (days <= 21) return "p1";
  }
  if (headcount != null && headcount >= 60) return "p1";
  return "p2";
}

function taskTitle(input: { organisation: string | null; headcount: number | null; kind: RequesterKind; venue: string | null }): string {
  const who = input.organisation || (input.kind === "company" ? "Company booking" : "Community booking");
  const size = input.headcount ? `${input.headcount} people` : "size not set";
  const place = input.venue ? ` at ${input.venue}` : "";
  return `Book ${who} — ${size}${place}`;
}

function replyFor(input: {
  sender: string | null;
  organisation: string | null;
  kind: RequesterKind;
  eventDate: string | null;
  headcount: number | null;
  needs: string[];
}): string {
  const name = input.sender ? input.sender.split(" ")[0] : "there";
  const kindLabel = input.kind === "unknown" ? "booking" : `${input.kind} booking`;
  const who = input.organisation ? ` for ${input.organisation}` : "";
  const when = input.eventDate ? ` on ${formatDate(input.eventDate)}` : "";
  const size = input.headcount ? ` for ${input.headcount} people` : "";
  const needs = input.needs.length ? ` You asked for ${input.needs.join(", ")}.` : "";
  return `Thanks ${name}. I have this as a ${kindLabel}${who}${when}${size}.${needs} A person here will confirm the price before anyone replies.`;
}

export function parseKind(text: string): RequesterKind {
  if (/\bnot a company\b/i.test(text)) return "community";
  if (/\b(company offsite|company booking|paid company|corporate|away day|our company|client event)\b/i.test(text)) return "company";
  if (/\b(community|meetup|user group|hackathon|chapter)\b/i.test(text)) return "community";
  if (/\b(offsite|corporate)\b/i.test(text)) return "company";
  return "unknown";
}

export function parseHeadcount(text: string): number | null {
  const patterns = [
    /\b(\d{1,4})\s*(?:\+|plus)?\s*(?:people|persons|person|pax|guests|attendees|heads|capacity)\b/i,
    /\b(?:about|around|approx(?:imately)?|~)\s*(\d{1,4})\b/i,
    /\bcap(?:acity)?\s*(?:of|at)?\s*(\d{1,4})\b/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const value = Number(match[1]);
    if (value >= 5 && value <= 5000) return value;
  }
  return null;
}

export function parseDate(text: string): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dayFirst = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?/i,
  );
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    if (month) return stamp(Number(dayFirst[1]), month, dayFirst[3] ? Number(dayFirst[3]) : undefined);
  }
  const monthFirst = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(20\d{2}))?/i,
  );
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    if (month) return stamp(Number(monthFirst[2]), month, monthFirst[3] ? Number(monthFirst[3]) : undefined);
  }
  return null;
}

function stamp(day: number, month: number, year?: number): string | null {
  if (day < 1 || day > 31) return null;
  const resolved = year ?? inferYear(month, day);
  return `${resolved}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferYear(month: number, day: number): number {
  const today = new Date();
  const year = today.getFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  const todayUtc = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  if (candidate < todayUtc - 30 * 86_400_000) return year + 1;
  return year;
}

function parseSender(text: string, given?: string): string | null {
  if (given?.trim()) return given.trim();
  const named = text.match(/\b(?:this is|i'm|i am|my name is)\s+([A-Za-z][A-Za-z'`.-]*(?:\s+[A-Za-z][A-Za-z'`.-]*){0,2})/i);
  if (named) return named[1].replace(/\s+(from|at|with)$/i, "").trim();
  const fromLine = text.match(/(?:^|\n)\s*from:\s*([^\n(]+)/i);
  if (fromLine) return fromLine[1].trim();
  return null;
}

function parseOrganisation(text: string): string | null {
  const labelled = text.match(/\bfrom\s+(.+?)\s*\((?:SAMPLE|fictional)\)/i);
  if (labelled) return labelled[1].replace(/\s+/g, " ").trim();
  const from = text.match(/\bfrom\s+([A-Z][^.\n,]{2,70}?)(?:\.|,|\n|\s+can\b|\s+we\b|\s+on\b)/);
  if (from && !/^(the|our|a|an)\b/i.test(from[1])) return from[1].trim();
  return null;
}

function parseNeeds(text: string): string[] {
  const rules: Array<[string, RegExp]> = [
    ["food", /\b(pizza|food|catering|dinner|lunch|supper|nibbles)\b/i],
    ["drinks", /\b(drinks|beer|wine|coffee)\b/i],
    ["projector", /\b(projector|screen|hdmi|microphone|\bmic\b|\bav\b)\b/i],
    ["room", /\b(room|space|venue|hire)\b/i],
    ["evening", /\b(evening|tonight)\b/i],
  ];
  return rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

function parseVenue(text: string): string | null {
  const hits = PLACES.filter((place) => text.toLowerCase().includes(place.toLowerCase()));
  return hits.length ? hits.join(", ") : null;
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${day} ${names[month - 1]} ${year}`;
}

function clipInput(message: string): string {
  const clean = message.replace(/\s+/g, " ").trim();
  return clean.length > 140 ? `${clean.slice(0, 139)}…` : clean;
}

function loadRequest(db: Db, id: string) {
  return db.get<Record<string, unknown>>("SELECT * FROM requests WHERE id = ?", [id]);
}

function loadTask(db: Db, id: string) {
  return db.get<Record<string, unknown>>("SELECT * FROM tasks WHERE id = ?", [id]);
}
