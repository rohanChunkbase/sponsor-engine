import assert from "node:assert/strict";
import { after, test } from "node:test";
import { acceptInbound, parseEmail } from "../src/index.ts";
import { fixture, tempDb } from "./helpers.ts";

const db = tempDb();

after(() => {
  db.close();
});

test("eml fixture keeps the sender, the subject, and the date", () => {
  const [message] = parseEmail(fixture("email.eml"));
  assert.equal(message.channel, "email");
  assert.equal(message.from, "Ada Fernwood");
  assert.equal(message.threadId, "booking-26-nov@thames.example");
  assert.equal(message.receivedAt, "2026-10-22T18:05:00.000Z");
  assert.match(message.text, /^Subject: Community booking 26 November/);
  assert.match(message.text, /80 people/);
});

test("pasted email text keeps the sender and the subject", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  const [message] = parseEmail(fixture("email.txt"), now);
  assert.equal(message.from, "Jonah Calder");
  assert.equal(message.receivedAt, now.toISOString());
  assert.match(message.text, /Subject: Thursday room/);
  assert.match(message.text, /40 people/);
  assert.match(message.threadId, /^email-[a-f0-9]{12}$/);
});

test("a plain note, a quoted part, and html all stay readable", () => {
  const now = new Date("2026-10-22T12:00:00.000Z");
  const [note] = parseEmail("Please book 30 people on 2 December.", now);
  assert.equal(note.from, "email");
  assert.equal(note.text, "Please book 30 people on 2 December.");

  const [quoted] = parseEmail([
    "From: Priya Shah <priya@example.com>",
    "Subject: Room",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    "80 people on 26 November. Caf=C3=A9.",
  ].join("\n"));
  assert.equal(quoted.from, "Priya Shah");
  assert.match(quoted.text, /Café/);

  const [html] = parseEmail([
    "From: Desk <desk@example.com>",
    'Content-Type: multipart/alternative; boundary="bound"',
    "",
    "--bound",
    "Content-Type: text/html",
    "",
    "<p>HTML only</p>",
    "--bound",
    "Content-Type: text/plain",
    "",
    "Plain booking for 20 people",
    "--bound--",
  ].join("\n"));
  assert.equal(html.from, "Desk");
  assert.match(html.text, /Plain booking for 20 people/);
  assert.doesNotMatch(html.text, /HTML only/);
});

test("bad email text does not throw", () => {
  assert.deepEqual(parseEmail(""), []);
  assert.deepEqual(parseEmail("From: \n\n"), []);
});

test("an email booking waits in the outbox and is not sent", async () => {
  const [inbound] = parseEmail(fixture("email.eml"));
  const receipt = await acceptInbound(db, inbound);
  assert.equal(receipt.ok, true);
  assert.equal(receipt.sent, false);
  assert.equal(receipt.outbox?.status, "awaiting_approval");
});
