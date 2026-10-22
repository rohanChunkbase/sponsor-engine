import { parseIsoDate, type Weekday } from '../dates.js';
import { mulberry32, shuffleInPlace, triangular } from '../prng.js';
import type { BookerType, Booking } from '../types.js';
import { priceFromTariff } from './tariff.js';

/** Seed for the checked-in SAMPLE file. The same seed makes the same 300 rows. */
export const DEFAULT_SEED = 20261022;
export const SAMPLE_BOOKING_COUNT = 300;
export const SAMPLE_VENUE_NAME = 'Riverworks Hall (SAMPLE)';
export const SAMPLE_START_DATE = '2024-10-01';
export const SAMPLE_END_DATE = '2026-09-30';

const START_UTC = Date.UTC(2024, 9, 1);
const END_UTC = Date.UTC(2026, 8, 30);
const SPAN_DAYS = Math.round((END_UTC - START_UTC) / 86_400_000);

/** Month weights. Index 1 is January. August and late December are quiet. */
const MONTH_WEIGHT = [0, 1.1, 1.15, 1.2, 1.1, 1.05, 0.95, 0.8, 0.55, 1.15, 1.25, 1.2, 0.7];
const MAX_MONTH_WEIGHT = 1.25;

/**
 * Weekday weights. Index 0 is Sunday.
 * Communities use Tuesday, Wednesday, and Thursday.
 * Companies use Tuesday, Wednesday, and Thursday in the day.
 */
const WEEKDAY_WEIGHT: Record<BookerType, readonly number[]> = {
  community: [0.06, 0.08, 0.22, 0.24, 0.22, 0.1, 0.08],
  startup: [0.1, 0.08, 0.12, 0.14, 0.22, 0.18, 0.16],
  company: [0.01, 0.12, 0.28, 0.3, 0.22, 0.06, 0.01],
  agency: [0.14, 0.1, 0.16, 0.16, 0.14, 0.12, 0.18],
};

export interface GenerateOptions {
  count?: number;
  seed?: number;
}

interface Draft {
  seq: number;
  bookerType: BookerType;
  alias: string;
  date: string;
  weekday: Weekday;
  isEvening: boolean;
  isWeekend: boolean;
  hours: number;
  headcount: number;
  broughtLeads: boolean;
  avNeeds: boolean;
  cateringNeeds: boolean;
  repeatBookerCount: number;
}

function sampleMix(count: number): Record<BookerType, number> {
  if (count === SAMPLE_BOOKING_COUNT) {
    return { community: 168, startup: 60, agency: 42, company: 30 };
  }
  const community = Math.round(count * 0.56);
  const startup = Math.round(count * 0.2);
  const agency = Math.round(count * 0.14);
  let company = count - community - startup - agency;
  if (company < 0) {
    return {
      community: count,
      startup: 0,
      agency: 0,
      company: 0,
    };
  }
  return { community, startup, agency, company };
}

function dateFromOffset(offset: number): string {
  const utc = new Date(START_UTC + offset * 86_400_000);
  const month = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const day = String(utc.getUTCDate()).padStart(2, '0');
  return `${utc.getUTCFullYear()}-${month}-${day}`;
}

function dateWeight(iso: string): number {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  let weight = MONTH_WEIGHT[month] ?? 1;
  if (month === 12 && day >= 20) weight *= 0.35;
  return weight;
}

function drawDate(
  rng: () => number,
  bookerType: BookerType,
): { date: string; weekday: Weekday; isWeekend: boolean } {
  const weights = WEEKDAY_WEIGHT[bookerType];
  const maxWeekday = Math.max(...weights);
  for (let attempt = 0; attempt < 8000; attempt += 1) {
    const offset = Math.floor(rng() * (SPAN_DAYS + 1));
    const date = dateFromOffset(offset);
    if (rng() > dateWeight(date) / MAX_MONTH_WEIGHT) continue;
    const parsed = parseIsoDate(date);
    const weekdayWeight = weights[parsed.weekdayIndex] ?? 0;
    if (rng() > weekdayWeight / maxWeekday) continue;
    return { date, weekday: parsed.weekday, isWeekend: parsed.isCalendarWeekend };
  }
  throw new Error('The generator could not draw a date.');
}

function eveningProbability(bookerType: BookerType, isWeekend: boolean): number {
  if (bookerType === 'community') return isWeekend ? 0.3 : 0.93;
  if (bookerType === 'startup') return isWeekend ? 0.5 : 0.78;
  if (bookerType === 'company') return isWeekend ? 0.35 : 0.12;
  return isWeekend ? 0.48 : 0.3;
}

function snapHalf(value: number, min: number, max: number): number {
  const snapped = Math.round(value * 2) / 2;
  return Math.min(max, Math.max(min, snapped));
}

function drawHours(rng: () => number, draft: Pick<Draft, 'bookerType' | 'isEvening'>): number {
  if (draft.bookerType === 'community' && draft.isEvening) {
    return snapHalf(triangular(rng, 2.5, 3.5, 5), 2.5, 5);
  }
  if (draft.bookerType === 'community') {
    return snapHalf(triangular(rng, 6, 9, 12), 6, 12);
  }
  if (draft.bookerType === 'startup' && draft.isEvening) {
    return snapHalf(triangular(rng, 3, 4, 6), 3, 6);
  }
  if (draft.bookerType === 'startup') {
    return snapHalf(triangular(rng, 4, 6, 8), 4, 8);
  }
  if (draft.bookerType === 'company') {
    return snapHalf(triangular(rng, 6, 8, 10), 6, 10);
  }
  return snapHalf(triangular(rng, 4, 6, 9), 4, 9);
}

function drawHeadcount(rng: () => number, bookerType: BookerType): number {
  const spec =
    bookerType === 'community'
      ? [25, 55, 120]
      : bookerType === 'startup'
        ? [30, 80, 150]
        : bookerType === 'company'
          ? [12, 40, 90]
          : [15, 35, 80];
  const value = Math.round(triangular(rng, spec[0] as number, spec[1] as number, spec[2] as number));
  return Math.min(spec[2] as number, Math.max(spec[0] as number, value));
}

function bernoulli(rng: () => number, probability: number): boolean {
  return rng() < probability;
}

function leadProbability(bookerType: BookerType): number {
  if (bookerType === 'community') return 0.72;
  if (bookerType === 'startup') return 0.3;
  if (bookerType === 'agency') return 0.12;
  return 0.08;
}

function avProbability(bookerType: BookerType): number {
  if (bookerType === 'community') return 0.55;
  if (bookerType === 'startup') return 0.85;
  if (bookerType === 'company') return 0.95;
  return 0.7;
}

function cateringProbability(bookerType: BookerType): number {
  if (bookerType === 'community') return 0.15;
  if (bookerType === 'startup') return 0.65;
  if (bookerType === 'company') return 0.9;
  return 0.4;
}

interface PoolMember {
  alias: string;
  weight: number;
}

function makePool(prefix: string, size: number, zipf: 'steep' | 'mild'): PoolMember[] {
  return Array.from({ length: size }, (_, index) => ({
    alias: `${prefix}${String(index + 1).padStart(2, '0')}`,
    weight: zipf === 'steep' ? 1 / (index + 1) : 1 / Math.sqrt(index + 1),
  }));
}

function pickWeighted(rng: () => number, pool: readonly PoolMember[]): string {
  const total = pool.reduce((sum, member) => sum + member.weight, 0);
  let cursor = rng() * total;
  for (const member of pool) {
    cursor -= member.weight;
    if (cursor <= 0) return member.alias;
  }
  return pool[pool.length - 1]?.alias ?? 'X00';
}

/**
 * Build a fictional booking history for one London event room.
 * Every row has dataLabel SAMPLE. The rows are not real Night Office bookings.
 */
export function generateSampleBookings(options: GenerateOptions = {}): Booking[] {
  const count = options.count ?? SAMPLE_BOOKING_COUNT;
  const seed = options.seed ?? DEFAULT_SEED;
  if (!Number.isInteger(count) || count < 4) {
    throw new Error('The SAMPLE count must be a whole number of 4 or more.');
  }
  const rng = mulberry32(seed);
  const mix = sampleMix(count);
  const types: BookerType[] = [
    ...Array<BookerType>(mix.community).fill('community'),
    ...Array<BookerType>(mix.startup).fill('startup'),
    ...Array<BookerType>(mix.agency).fill('agency'),
    ...Array<BookerType>(mix.company).fill('company'),
  ];
  shuffleInPlace(types, rng);

  const communityPool = makePool('C', Math.min(14, Math.max(1, mix.community)), 'steep');
  const startupPool = makePool('S', Math.min(36, Math.max(1, mix.startup)), 'mild');
  const agencyPool = makePool('A', Math.min(12, Math.max(1, mix.agency)), 'mild');
  const companyAliases = Array.from({ length: mix.company }, (_, index) => {
    return `CO${String(index + 1).padStart(2, '0')}`;
  });
  shuffleInPlace(companyAliases, rng);

  const drafts: Draft[] = types.map((bookerType, seq) => {
    const when = drawDate(rng, bookerType);
    const isEvening = bernoulli(rng, eveningProbability(bookerType, when.isWeekend));
    const alias =
      bookerType === 'community'
        ? pickWeighted(rng, communityPool)
        : bookerType === 'startup'
          ? pickWeighted(rng, startupPool)
          : bookerType === 'agency'
            ? pickWeighted(rng, agencyPool)
            : (companyAliases.pop() ?? `CO${String(seq).padStart(2, '0')}`);
    return {
      seq,
      bookerType,
      alias,
      date: when.date,
      weekday: when.weekday,
      isEvening,
      isWeekend: when.isWeekend,
      hours: drawHours(rng, { bookerType, isEvening }),
      headcount: drawHeadcount(rng, bookerType),
      broughtLeads: bernoulli(rng, leadProbability(bookerType)),
      avNeeds: bernoulli(rng, avProbability(bookerType)),
      cateringNeeds: bernoulli(rng, cateringProbability(bookerType)),
      repeatBookerCount: 0,
    };
  });

  drafts.sort((a, b) => (a.date === b.date ? a.seq - b.seq : a.date < b.date ? -1 : 1));
  const seen = new Map<string, number>();
  for (const draft of drafts) {
    const prior = seen.get(draft.alias) ?? 0;
    draft.repeatBookerCount = prior;
    seen.set(draft.alias, prior + 1);
  }

  return drafts.map((draft, index) => {
    const priced = priceFromTariff(draft, rng);
    const booking: Booking = {
      bookingId: `B${String(index + 1).padStart(3, '0')}`,
      dataLabel: 'SAMPLE',
      venueName: SAMPLE_VENUE_NAME,
      date: draft.date,
      weekday: draft.weekday,
      isEvening: draft.isEvening,
      isWeekend: draft.isWeekend,
      hours: draft.hours,
      headcount: draft.headcount,
      bookerType: draft.bookerType,
      bookerAlias: draft.alias,
      repeatBookerCount: draft.repeatBookerCount,
      broughtLeads: draft.broughtLeads,
      avNeeds: draft.avNeeds,
      cateringNeeds: draft.cateringNeeds,
      pricePaidGbp: priced.pricePaidGbp,
      freeCommunitySlot: priced.freeCommunitySlot,
    };
    return booking;
  });
}
