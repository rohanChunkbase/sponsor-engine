import { readFileSync } from 'node:fs';

import { normalizeHeader, parseCsv } from './csv.js';
import { BookingDataError } from './errors.js';
import { formatGbp } from './money.js';
import { LONDON_MARKET_CSV_PATH } from './paths.js';
import type { MarketCheckResult, QuoteRequest } from './types.js';

/** Published ~4h evening hire, after the two large-room outliers are removed. */
export const MARKET_EVENING_LOW_GBP = 400;
export const MARKET_EVENING_HIGH_GBP = 3200;
export const MARKET_EVENING_MEDIAN_GBP = 1350;

export interface MarketRoom {
  venue: string;
  area: string;
  space: string;
  capacityText: string;
  /** Standing capacity when the page gives one, otherwise the largest count on the row. */
  capacity: number | null;
  price: number | null;
  url: string;
  normMethod: string;
  comparable: boolean;
}

const cache = new Map<string, MarketRoom[]>();

function columnIndex(headers: readonly string[], name: string): number {
  const want = normalizeHeader(name);
  const index = headers.findIndex((header) => normalizeHeader(header) === want);
  if (index < 0) {
    throw new BookingDataError(`The market CSV has no column ${name}.`);
  }
  return index;
}

/** Event capacity from a public capacity cell. Returns null when the page gives no count. */
export function parseCapacity(raw: string): number | null {
  const text = raw.trim().toLowerCase();
  if (text === '' || text === 'not stated' || text === 'varies') return null;
  const labelled = (label: string): number[] => {
    const found: number[] = [];
    const pattern = new RegExp(`(\\d[\\d,]*)\\s+${label}`, 'g');
    for (const match of text.matchAll(pattern)) {
      found.push(Number((match[1] ?? '').replace(/,/g, '')));
    }
    return found.filter((value) => Number.isFinite(value));
  };
  for (const label of ['standing', 'reception', 'guests?', 'theatre', 'seated']) {
    const values = labelled(label);
    if (values.length > 0) return Math.max(...values);
  }
  const any = [...text.matchAll(/(\d[\d,]*)/g)]
    .map((match) => Number((match[1] ?? '').replace(/,/g, '')))
    .filter((value) => Number.isFinite(value));
  if (any.length === 0) return null;
  return Math.max(...any);
}

function parsePrice(raw: string): number | null {
  const cleaned = raw.replace(/£/g, '').replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/** The two rooms the market note leaves out: Somerset House River Terrace and Tobacco Dock Little Gallery. */
export function isMarketOutlier(venue: string, space: string): boolean {
  const room = `${venue} ${space}`.toLowerCase();
  if (room.includes('tobacco dock') && room.includes('little gallery')) return true;
  if (room.includes('somerset house') && room.includes('river terrace')) return true;
  return false;
}

function displayName(venue: string, space: string): string {
  const room = space.trim();
  if (room === '') return venue.trim();
  return `${venue.trim()} (${room})`;
}

/** Load the public market table. Pass CSV text in tests. The file load is cached. */
export function loadLondonMarket(csvText?: string): MarketRoom[] {
  if (csvText === undefined) {
    const hit = cache.get(LONDON_MARKET_CSV_PATH);
    if (hit) return hit;
  }
  const text = csvText ?? readFileSync(LONDON_MARKET_CSV_PATH, 'utf8');
  const table = parseCsv(text);
  const header = table[0];
  if (!header || table.length < 2) {
    throw new BookingDataError('The market CSV has no venue rows.');
  }
  const venueIndex = columnIndex(header, 'venue');
  const areaIndex = columnIndex(header, 'area');
  const spaceIndex = columnIndex(header, 'space');
  const capacityIndex = columnIndex(header, 'capacity');
  const priceIndex = columnIndex(header, 'gbp_per_4h_evening_norm');
  const urlIndex = columnIndex(header, 'source_url');
  const methodIndex = columnIndex(header, 'norm_method');

  const rooms: MarketRoom[] = [];
  for (let i = 1; i < table.length; i += 1) {
    const row = table[i];
    if (!row) continue;
    const venue = (row[venueIndex] ?? '').trim();
    const space = (row[spaceIndex] ?? '').trim();
    if (venue === '' && space === '') continue;
    const price = parsePrice(row[priceIndex] ?? '');
    const outlier = isMarketOutlier(venue, space);
    rooms.push({
      venue,
      area: (row[areaIndex] ?? '').trim(),
      space,
      capacityText: (row[capacityIndex] ?? '').trim(),
      capacity: parseCapacity(row[capacityIndex] ?? ''),
      price,
      url: (row[urlIndex] ?? '').trim(),
      normMethod: (row[methodIndex] ?? '').trim(),
      comparable: price !== null && !outlier,
    });
  }
  if (csvText === undefined) cache.set(LONDON_MARKET_CSV_PATH, rooms);
  return rooms;
}

/** Rooms with a ~4h evening hire figure, without the two large-room outliers. */
export function comparableEveningRooms(rooms: readonly MarketRoom[] = loadLondonMarket()): MarketRoom[] {
  return rooms.filter((room) => room.comparable && room.price !== null && room.capacity !== null);
}

function similarRooms(rooms: readonly MarketRoom[], capacity: number): MarketRoom[] {
  let window = Math.max(20, capacity * 0.35);
  let chosen: MarketRoom[] = [];
  for (let step = 0; step < 8; step += 1) {
    chosen = rooms.filter((room) => Math.abs((room.capacity ?? 0) - capacity) <= window);
    if (chosen.length >= 3) return chosen;
    window *= 1.6;
  }
  return rooms.slice();
}

/**
 * Place a GBP quote against published London rooms of similar capacity.
 * The prices are ~4h evening hire. VAT is not adjusted. Pubs that publish
 * only a minimum spend are not in this set.
 */
export function marketCheck(quote: number, capacity: number): MarketCheckResult {
  if (!Number.isFinite(quote) || quote < 0) {
    throw new BookingDataError('marketCheck needs a quote of 0 GBP or more.');
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new BookingDataError('marketCheck needs a capacity of 1 person or more.');
  }
  const pool = comparableEveningRooms();
  if (pool.length === 0) {
    throw new BookingDataError('The market file has no comparable evening prices.');
  }
  const similar = similarRooms(pool, capacity);
  const atOrBelow = similar.filter((room) => (room.price ?? 0) <= quote).length;
  const percentile = Math.round((100 * atOrBelow) / similar.length);
  const nearest = [...similar]
    .sort((left, right) => {
      const capacityGap =
        Math.abs((left.capacity ?? 0) - capacity) - Math.abs((right.capacity ?? 0) - capacity);
      if (capacityGap !== 0) return capacityGap;
      const priceGap = Math.abs((left.price ?? 0) - quote) - Math.abs((right.price ?? 0) - quote);
      if (priceGap !== 0) return priceGap;
      return displayName(left.venue, left.space).localeCompare(displayName(right.venue, right.space));
    })
    .slice(0, 3)
    .map((room) => ({
      name: displayName(room.venue, room.space),
      price: room.price ?? 0,
      url: room.url,
      capacity: room.capacity ?? 0,
    }));
  const prices = nearest.map((room) => room.price);
  return {
    quote,
    capacity,
    comparedCount: similar.length,
    percentile,
    low: Math.min(...prices),
    high: Math.max(...prices),
    nearest,
  };
}

function article(bookerType: QuoteRequest['bookerType']): string {
  return bookerType === 'agency' ? 'An' : 'A';
}

function shape(request: QuoteRequest): string {
  if (request.isWeekend && request.isEvening) return 'weekend evening';
  if (request.isWeekend) return 'weekend day';
  if (request.isEvening) return 'evening';
  return 'day';
}

/** One sentence that places this quote next to published London rooms. */
export function marketSentence(request: QuoteRequest, check: MarketCheckResult): string {
  const priced = [...check.nearest].sort((left, right) => left.price - right.price);
  const lowRoom = priced[0];
  const highRoom = priced[priced.length - 1];
  if (!lowRoom || !highRoom) {
    return 'No published London room of a similar size is in the market file.';
  }
  const names = lowRoom.name === highRoom.name ? lowRoom.name : `${lowRoom.name}, ${highRoom.name}`;
  const sameShape = request.isEvening && request.hours >= 3 && request.hours <= 5;
  const marketNote = sameShape ? '' : ' for about 4 evening hours';
  return `${article(request.bookerType)} ${request.bookerType} ${shape(request)} for ${request.headcount} here is ${formatGbp(check.quote)}; similar London rooms publish ${formatGbp(check.low)} to ${formatGbp(check.high)}${marketNote} (${names}).`;
}
