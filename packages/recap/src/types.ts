export type CardKind = "winner" | "sponsors" | "summary";

export type CardFormat = "landscape" | "portrait";

export type WinnerInput = {
  place: string;
  team: string;
  project: string;
  url?: string;
};

export type AnnounceWinnersInput = {
  eventName: string;
  date: string;
  venue: string;
  attendeeCount?: number;
  sponsors: readonly string[];
  winners: readonly WinnerInput[];
  /** A Luma event payload. Only an aggregate guest count is read. */
  luma?: unknown;
  /** True when the winners are placeholders, not the night's result. */
  example?: boolean;
};

export type RecapWinner = {
  place: string;
  placeLabel: string;
  team: string;
  project: string;
  url?: string;
};

export type RecapCard = {
  id: string;
  kind: CardKind;
  index: number;
  heading: string;
  lines: string[];
  caption: string;
};

export type Recap = {
  slug: string;
  example: boolean;
  eventName: string;
  date: string;
  venue: string;
  attendeeCount?: number;
  sponsors: string[];
  winners: RecapWinner[];
  cards: RecapCard[];
};

export type CardSpec = {
  format: CardFormat;
  width: number;
  height: number;
  kind: CardKind;
  example: boolean;
  kicker: string;
  heading: string;
  lines: string[];
  footer: string;
};
