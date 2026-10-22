import type { Db } from "@sponsor-engine/db";
import * as chrono from "chrono-node";
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
  /** Pin "today" in tests. Live calls use the clock. */
  now?: Date;
};

export function triageInbound(db: Db, input: TriageInput) {
  const message = (input.message ?? "").trim();
  const channel = input.channel?.trim() || "web";
  const now = input.now ?? new Date();
  const sender = parseSender(message, input.sender_name);
  const organisation = parseOrganisation(message);
  const eventDate = parseDate(message, now);
  const badDate = dateProblem(message, now);
  const heads = parseHeadcountDetail(message);
  const headcount = heads?.value ?? null;
  const needs = parseNeeds(message);
  const kind = parseKind(message);
  const venue = parseVenue(message);
  const intent = /\b(book|booking|hire|quote|reserve|host)\b/i.test(message);
  const parsed = message.length >= 12 && Boolean(headcount || eventDate || badDate) && (intent || kind !== "unknown" || Boolean(organisation) || Boolean(badDate));

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
  const reply = replyFor({
    sender,
    organisation,
    kind,
    eventDate,
    headcount,
    headcountLow: heads?.low ?? null,
    headcountHigh: heads?.high ?? null,
    needs,
    badDate,
  });

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
  headcountLow: number | null;
  headcountHigh: number | null;
  needs: string[];
  badDate: string | null;
}): string {
  const name = input.sender ? input.sender.split(" ")[0] : input.organisation || "there";
  const kindLabel = input.kind === "unknown" ? "booking" : `${input.kind} booking`;
  const who = input.organisation ? ` for ${input.organisation}` : "";
  const when = input.eventDate ? ` on ${formatDate(input.eventDate)}` : "";
  const size = headcountPhrase(input.headcount, input.headcountLow, input.headcountHigh);
  const needs = input.needs.length ? ` You asked for ${input.needs.join(", ")}.` : "";
  const question = input.badDate ? ` ${input.badDate} is not a real day. Which day did you mean?` : "";
  return `Thanks ${name}. I have this as a ${kindLabel}${who}${when}${size}.${needs}${question} A person here will confirm the price before anyone replies.`;
}

function headcountPhrase(value: number | null, low: number | null, high: number | null): string {
  if (!value) return "";
  if (low != null && high != null && low !== high) {
    return ` for ${value} people (you said ${low} to ${high})`;
  }
  return ` for ${value} people`;
}

export function parseKind(text: string): RequesterKind {
  if (/\bnot a company\b/i.test(text)) return "community";
  if (/\b(company offsite|company booking|paid company|corporate|away day|our company|client event)\b/i.test(text)) return "company";
  if (/\b(community|meetup|user group|hackathon|chapter)\b/i.test(text)) return "community";
  if (/\b(offsite|corporate)\b/i.test(text)) return "company";
  return "unknown";
}

const HEADCOUNT_UNIT = "people|persons|person|pax|ppl|guests|attendees|heads|staff|hackers|builders|capacity";

export type HeadcountDetail = { value: number; low: number; high: number };

export function parseHeadcount(text: string): number | null {
  return parseHeadcountDetail(text)?.value ?? null;
}

export function parseHeadcountDetail(text: string): HeadcountDetail | null {
  const range = text.match(
    new RegExp(`\\b(\\d{1,4})\\s*[-–—]\\s*(\\d{1,4})\\s*(?:\\+|plus)?\\s*(?:${HEADCOUNT_UNIT})\\b`, "i"),
  );
  if (range) {
    const low = Number(range[1]);
    const high = Number(range[2]);
    if (isHeadcount(low) && isHeadcount(high) && low <= high) {
      return { value: Math.round((low + high) / 2), low, high };
    }
  }
  const exact = text.match(new RegExp(`\\b(\\d{1,4})\\s*-?\\s*(?:\\+|plus)?\\s*(?:${HEADCOUNT_UNIT})\\b`, "i"));
  if (exact) {
    const value = Number(exact[1]);
    if (isHeadcount(value)) return { value, low: value, high: value };
  }
  const ofUs = text.match(/\b(\d{1,4})\s+of\s+us\b/i);
  if (ofUs) {
    const value = Number(ofUs[1]);
    if (isHeadcount(value)) return { value, low: value, high: value };
  }
  const about = text.match(/\b(?:about|around|approx(?:imately)?|~)\s*(\d{1,4})\b(?!\s*:\d)/i);
  if (about) {
    const value = Number(about[1]);
    if (isHeadcount(value)) return { value, low: value, high: value };
  }
  const cap = text.match(/\bcap(?:acity)?\s*(?:of|at)?\s*(\d{1,4})\b/i);
  if (cap) {
    const value = Number(cap[1]);
    if (isHeadcount(value)) return { value, low: value, high: value };
  }
  return null;
}

function isHeadcount(value: number): boolean {
  if (value >= 1900 && value <= 2100) return false;
  return value >= 5 && value <= 5000;
}

const DAY_FIRST =
  /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?/i;
const MONTH_FIRST =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(20\d{2}))?/i;

export function parseDate(text: string, now: Date = new Date()): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) {
    if (!isRealDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) return null;
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const dayFirst = text.match(DAY_FIRST);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    if (month) return stamp(Number(dayFirst[1]), month, dayFirst[3] ? Number(dayFirst[3]) : undefined, now);
  }
  const monthFirst = text.match(MONTH_FIRST);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    if (month) return stamp(Number(monthFirst[2]), month, monthFirst[3] ? Number(monthFirst[3]) : undefined, now);
  }
  const lateSaturday = parseLateSaturday(text, now);
  if (lateSaturday) return lateSaturday;
  return parseRelativeDate(text, now);
}

/** The date text the sender wrote, when that day is not on the calendar. */
export function dateProblem(text: string, now: Date = new Date()): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso && !isRealDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))) return iso[0];
  const dayFirst = text.match(DAY_FIRST);
  if (dayFirst) {
    const month = MONTHS[dayFirst[2].toLowerCase()];
    if (month && !calendarDay(Number(dayFirst[1]), month, dayFirst[3], now)) return dayFirst[0];
  }
  const monthFirst = text.match(MONTH_FIRST);
  if (monthFirst) {
    const month = MONTHS[monthFirst[1].toLowerCase()];
    if (month && !calendarDay(Number(monthFirst[2]), month, monthFirst[3], now)) return monthFirst[0];
  }
  return null;
}

function calendarDay(day: number, month: number, yearText: string | undefined, now: Date): boolean {
  const year = yearText ? Number(yearText) : inferYear(month, day, now);
  return isRealDate(year, month, day);
}

function isRealDate(year: number, month: number, day: number): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const utc = new Date(Date.UTC(year, month - 1, day));
  return utc.getUTCFullYear() === year && utc.getUTCMonth() === month - 1 && utc.getUTCDate() === day;
}

function parseLateSaturday(text: string, now: Date): string | null {
  const match = text.match(/\bsaturday\s+in\s+late\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i);
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const thisYear = lastSaturday(now.getFullYear(), month);
  const year = Date.UTC(now.getFullYear(), month - 1, thisYear) < Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
    ? now.getFullYear() + 1
    : now.getFullYear();
  const day = year === now.getFullYear() ? thisYear : lastSaturday(year, month);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function lastSaturday(year: number, month: number): number {
  const last = new Date(Date.UTC(year, month, 0));
  const back = (last.getUTCDay() - 6 + 7) % 7;
  return last.getUTCDate() - back;
}

function parseRelativeDate(text: string, now: Date): string | null {
  const results = chrono.parse(text, now, { forwardDate: true });
  for (const result of results) {
    const start = result.start;
    if (!start.isCertain("day") && !start.isCertain("weekday")) continue;
    const date = start.date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    if (!year || month < 1 || day < 1) continue;
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return null;
}

function stamp(day: number, month: number, year: number | undefined, now: Date): string | null {
  const resolved = year ?? inferYear(month, day, now);
  if (!isRealDate(resolved, month, day)) return null;
  return `${resolved}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function inferYear(month: number, day: number, now: Date): number {
  const year = now.getFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
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
  const here = text.match(/(?:^|[.!?]\s*)(?:hi[!.,]?\s+)?([A-Z][A-Za-z0-9'’&]*(?:\s+[A-Z][A-Za-z0-9'’&]*){0,5})\s+here\b/);
  if (here && !/^(hi|hello)$/i.test(here[1])) return here[1].replace(/\s+/g, " ").trim();
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
  const name = names[month - 1];
  if (!name || !isRealDate(year, month, day)) return "the date you sent";
  return `${day} ${name} ${year}`;
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
