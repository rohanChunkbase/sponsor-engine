import { RecapInputError } from "./errors.js";
import { attendeeCountFromLuma } from "./luma.js";
import { formatRecapDate, placeLabel, recapSlug } from "./place.js";
import type { AnnounceWinnersInput, CardFormat, CardKind, CardSpec, Recap, RecapCard, RecapWinner } from "./types.js";

const FORMATS: Record<CardFormat, { width: number; height: number }> = {
  landscape: { width: 1200, height: 630 },
  portrait: { width: 1080, height: 1350 },
};

export function announceWinners(input: AnnounceWinnersInput): Recap {
  const eventName = requiredText(input.eventName, "The event needs a name.");
  const venue = requiredText(input.venue, "The event needs a venue.");
  const date = requiredDate(input.date);
  const sponsors = input.sponsors.map((name, index) => requiredText(name, `Sponsor ${index + 1} needs a name.`));
  const winners = input.winners.map((winner, index) => cleanWinner(winner, index));
  const fromLuma = attendeeCountFromLuma(input.luma);
  const attendeeCount = input.attendeeCount !== undefined ? requiredCount(input.attendeeCount) : fromLuma;
  const example = input.example === true;
  const slug = recapSlug(eventName, date);
  const footer = `${eventName} @ ${venue}`;
  const cards: RecapCard[] = [
    ...winners.map((winner, index) => winnerCard(winner, footer, index)),
    sponsorsCard(sponsors, footer),
    summaryCard({ eventName, date, venue, footer, attendeeCount, winners: winners.length, sponsors: sponsors.length }),
  ];

  const recap: Recap = {
    slug,
    example,
    eventName,
    date,
    venue,
    sponsors,
    winners,
    cards,
  };
  if (attendeeCount !== undefined) recap.attendeeCount = attendeeCount;
  return recap;
}

export function cardPath(slug: string, card: RecapCard, format: CardFormat): string {
  const params = new URLSearchParams({
    slug,
    kind: card.kind,
    index: String(card.kind === "winner" ? card.index : 0),
    format,
  });
  return `/api/recap/card?${params.toString()}`;
}

export function cardSpecFor(recap: Recap, kind: CardKind, index: number, format: CardFormat): CardSpec | undefined {
  const card = recap.cards.find((item) => item.kind === kind && (kind !== "winner" || item.index === index));
  if (!card) return undefined;
  const size = FORMATS[format];
  return {
    format,
    width: size.width,
    height: size.height,
    kind: card.kind,
    example: recap.example,
    kicker: recap.example ? "EXAMPLE" : formatRecapDate(recap.date),
    heading: card.heading,
    lines: card.lines,
    footer: `${formatRecapDate(recap.date)} · ${recap.eventName} @ ${recap.venue}`,
  };
}

function winnerCard(winner: RecapWinner, footer: string, index: number): RecapCard {
  const heading = `${winner.placeLabel} place`;
  const lines = [winner.team, winner.project];
  return {
    id: `winner-${index}`,
    kind: "winner",
    index,
    heading,
    lines,
    caption: `${heading}, ${winner.team}, ${winner.project}, ${footer}`,
  };
}

function sponsorsCard(sponsors: string[], footer: string): RecapCard {
  return {
    id: "sponsors",
    kind: "sponsors",
    index: 0,
    heading: "Thank you sponsors",
    lines: sponsors.length > 0 ? sponsors : ["No sponsors were named."],
    caption: `Thank you sponsors, ${footer}`,
  };
}

function summaryCard(input: {
  eventName: string;
  date: string;
  venue: string;
  footer: string;
  attendeeCount: number | undefined;
  winners: number;
  sponsors: number;
}): RecapCard {
  const lines = [
    formatRecapDate(input.date),
    input.venue,
    input.attendeeCount !== undefined ? `${input.attendeeCount} people` : "Headcount not recorded",
    `${input.winners} ${input.winners === 1 ? "winner" : "winners"}`,
    `${input.sponsors} ${input.sponsors === 1 ? "sponsor" : "sponsors"}`,
  ];
  return {
    id: "summary",
    kind: "summary",
    index: 0,
    heading: input.eventName,
    lines,
    caption: input.footer,
  };
}

function cleanWinner(winner: AnnounceWinnersInput["winners"][number], index: number): RecapWinner {
  const place = requiredText(winner.place, `Winner ${index + 1} needs a place.`);
  const team = requiredText(winner.team, `Winner ${index + 1} needs a team.`);
  const project = requiredText(winner.project, `Winner ${index + 1} needs a project.`);
  const cleaned: RecapWinner = { place, placeLabel: placeLabel(place), team, project };
  if (winner.url !== undefined) cleaned.url = requiredUrl(winner.url, `Winner ${index + 1} needs an http link.`);
  return cleaned;
}

function requiredText(value: string, message: string): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) throw new RecapInputError(message);
  if (trimmed.length > 80) throw new RecapInputError("Keep each name under 80 characters.");
  return trimmed;
}

function requiredDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RecapInputError("The date uses YYYY-MM-DD.");
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month! - 1 || parsed.getUTCDate() !== day) {
    throw new RecapInputError("The date is not a real calendar day.");
  }
  return value;
}

function requiredCount(value: number): number {
  if (!Number.isInteger(value) || value < 0) throw new RecapInputError("The headcount is a whole number.");
  return value;
}

function requiredUrl(value: string, message: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RecapInputError(message);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new RecapInputError(message);
  return parsed.toString();
}
