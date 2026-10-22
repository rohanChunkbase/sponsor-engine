import type { Weekday } from './dates.js';

export const BOOKER_TYPES = ['community', 'startup', 'company', 'agency'] as const;
export type BookerType = (typeof BOOKER_TYPES)[number];

export const DATA_LABELS = ['SAMPLE', 'REAL', 'REDACTED', 'UNSPECIFIED'] as const;
export type DataLabel = (typeof DATA_LABELS)[number];

export const MODEL_NAMES = ['knn-rules', 'gbdt'] as const;
export type ModelName = (typeof MODEL_NAMES)[number];

/**
 * One past booking at a single venue.
 * `dataLabel` is `SAMPLE` when the row comes from the fictional generator.
 */
export interface Booking {
  bookingId: string;
  dataLabel: DataLabel;
  venueName?: string;
  date: string;
  weekday: Weekday;
  isEvening: boolean;
  isWeekend: boolean;
  hours: number;
  headcount: number;
  bookerType: BookerType;
  bookerAlias?: string;
  repeatBookerCount: number;
  broughtLeads: boolean;
  avNeeds: boolean;
  cateringNeeds: boolean;
  pricePaidGbp: number;
  freeCommunitySlot: boolean;
}

/** A request for a new quote. The price is not part of the request. */
export interface QuoteRequest {
  date: string;
  isEvening: boolean;
  isWeekend: boolean;
  hours: number;
  headcount: number;
  bookerType: BookerType;
  repeatBookerCount: number;
  broughtLeads: boolean;
  avNeeds: boolean;
  cateringNeeds: boolean;
}

/** A past booking that the quote uses as evidence. */
export interface Comparable {
  bookingId: string;
  date: string;
  weekday: Weekday;
  bookerType: BookerType;
  isEvening: boolean;
  isWeekend: boolean;
  hours: number;
  headcount: number;
  repeatBookerCount: number;
  broughtLeads: boolean;
  avNeeds: boolean;
  cateringNeeds: boolean;
  pricePaidGbp: number;
  freeCommunitySlot: boolean;
  distance: number;
  weight: number;
}

export interface PriceRange {
  low: number;
  high: number;
}

/** One published London room used to place a quote. */
export interface MarketVenueMatch {
  name: string;
  price: number;
  url: string;
  capacity: number;
}

/**
 * Where a quote sits among published London rooms of a similar capacity.
 * The prices are about 4 evening hours of hire.
 */
export interface MarketCheckResult {
  /** The quote that was compared, in GBP. */
  quote: number;
  /** The headcount used to choose similar rooms. */
  capacity: number;
  /** Similar rooms in the published ~4h evening set. */
  comparedCount: number;
  /**
   * Share of those rooms whose published price is at or below the quote.
   * 0 means the quote is below every room. 100 means it is at or above every room.
   */
  percentile: number;
  /** Lowest published price among the nearest rooms. */
  low: number;
  /** Highest published price among the nearest rooms. */
  high: number;
  nearest: MarketVenueMatch[];
}

export interface Quote {
  price: number;
  currency: 'GBP';
  range: PriceRange;
  explanation: string;
  comparables: Comparable[];
}

export const CANONICAL_COLUMNS = [
  'booking_id',
  'data_label',
  'venue_name',
  'date',
  'weekday',
  'is_evening',
  'is_weekend',
  'hours',
  'headcount',
  'booker_type',
  'booker_alias',
  'repeat_booker_count',
  'brought_leads',
  'av_needs',
  'catering_needs',
  'price_paid_gbp',
  'free_community_slot',
] as const;

export type CanonicalColumn = (typeof CANONICAL_COLUMNS)[number];
