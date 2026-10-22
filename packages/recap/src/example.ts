import { announceWinners } from "./announce.js";
import type { Recap } from "./types.js";

/** Placeholder winners for the Expedite night. They are not the result of the event. */
export const EXPEDITE_EXAMPLE: Recap = announceWinners({
  eventName: "Hackathon at Expedite",
  date: "2026-10-22",
  venue: "Expedite",
  attendeeCount: 120,
  example: true,
  sponsors: ["Example Labs", "Example Cloud", "Example Works"],
  winners: [
    { place: "1", team: "EXAMPLE Team North", project: "EXAMPLE Raft Notes", url: "https://example.com/raft-notes" },
    { place: "2", team: "EXAMPLE Team West", project: "EXAMPLE Desk Light" },
    { place: "3", team: "EXAMPLE Team East", project: "EXAMPLE Outbox" },
  ],
});

export function getRecap(slug: string): Recap | undefined {
  if (slug === EXPEDITE_EXAMPLE.slug) return EXPEDITE_EXAMPLE;
  return undefined;
}
