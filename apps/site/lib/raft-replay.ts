export type RaftBeat = {
  tool: string;
  rows: { label: string; value: string }[];
};

export type RaftReplay = {
  channel: string;
  sender: string;
  message: string;
  beats: RaftBeat[];
  status: string;
  caption: string;
  cannedReply: string;
};

/**
 * Scripted landing-page ask.
 * Food uses the public benchmark: 28 percent no-show, then £5.50 for each expected person.
 * 120 people → 86 expected → £473 food.
 * The room is not priced. This replay has no Expedite booking history.
 * Sponsor names are the public Unicorn Mafia partners.
 */
export const unicornMafiaReplay: RaftReplay = {
  channel: "whatsapp",
  sender: "Unicorn Mafia",
  message: "Can we host 120 hackers at Expedite?",
  status: "awaiting approval",
  caption:
    "This is a scripted replay. It does not call a model. The food figure uses the public 28 percent no-show benchmark. It is not a live price for Expedite.",
  cannedReply: "This page replays one ask. Open Try it live to connect the desk.",
  beats: [
    {
      tool: "triage_inbound",
      rows: [
        { label: "community", value: "Unicorn Mafia" },
        { label: "headcount", value: "120" },
        { label: "need", value: "venue" },
        { label: "priority", value: "p0" },
        { label: "task", value: "Book Unicorn Mafia — 120 people" },
      ],
    },
    {
      tool: "quote_booking · forecast_turnout",
      rows: [
        { label: "show-up", value: "86 of 120" },
        { label: "basis", value: "28 percent no-show benchmark" },
        { label: "food", value: "£473" },
        { label: "room", value: "Needs past Expedite bookings" },
      ],
    },
    {
      tool: "find_sponsors",
      rows: [
        { label: "match", value: "Pydantic, Cognition, Render" },
        { label: "source", value: "https://luma.com/umhack" },
        { label: "venue", value: "Expedite" },
        { label: "venue source", value: "https://luma.com/eveur09a" },
      ],
    },
    {
      tool: "draft_sponsor_ask",
      rows: [
        { label: "subject", value: "Food for 120 hackers at Expedite" },
        { label: "status", value: "awaiting approval" },
      ],
    },
  ],
};
