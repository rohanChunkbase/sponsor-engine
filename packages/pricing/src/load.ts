import { readFileSync } from 'node:fs';

import { parseCsv, normalizeHeader } from './csv.js';
import { parseIsoDate, type Weekday } from './dates.js';
import { BookingDataError } from './errors.js';
import {
  BOOKER_TYPES,
  CANONICAL_COLUMNS,
  DATA_LABELS,
  type BookerType,
  type Booking,
  type DataLabel,
} from './types.js';

const HEADER_ALIASES: Record<string, readonly string[]> = {
  booking_id: ['booking_id', 'id'],
  data_label: ['data_label', 'label'],
  venue_name: ['venue_name', 'venue'],
  date: ['date', 'booking_date', 'event_date'],
  weekday: ['weekday', 'day_of_week'],
  is_evening: ['is_evening', 'evening'],
  is_weekend: ['is_weekend', 'weekend'],
  timing: ['timing', 'session', 'day_part'],
  hours: ['hours', 'duration_hours', 'duration'],
  headcount: ['headcount', 'guests', 'guest_count', 'covers'],
  booker_type: ['booker_type', 'booker', 'segment', 'customer_type'],
  booker_alias: ['booker_alias', 'booker_id', 'customer_id'],
  repeat_booker_count: ['repeat_booker_count', 'repeat_count', 'prior_bookings', 'previous_bookings'],
  brought_leads: ['brought_leads', 'brings_leads', 'leads'],
  av_needs: ['av_needs', 'needs_av', 'av'],
  catering_needs: ['catering_needs', 'needs_catering', 'catering'],
  av_catering: ['av_catering', 'av_and_catering', 'services'],
  price_paid_gbp: ['price_paid_gbp', 'price_paid', 'price_gbp', 'price', 'amount_gbp'],
  free_community_slot: ['free_community_slot', 'free_slot', 'is_free'],
};

function indexHeaders(headers: readonly string[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function findColumn(headers: Map<string, number>, field: string): number | undefined {
  const aliases = HEADER_ALIASES[field] ?? [field];
  for (const alias of aliases) {
    const index = headers.get(alias);
    if (index !== undefined) return index;
  }
  return undefined;
}

function cell(row: readonly string[], index: number | undefined): string {
  if (index === undefined) return '';
  return (row[index] ?? '').trim();
}

function parseBool(raw: string, rowNumber: number, column: string): boolean {
  const value = raw.trim().toLowerCase();
  if (value === 'y' || value === 'yes' || value === 'true' || value === '1') return true;
  if (value === 'n' || value === 'no' || value === 'false' || value === '0') return false;
  throw new BookingDataError(
    `Row ${rowNumber}: ${column} is "${raw}". Use y or n.`,
  );
}

function parseNumber(raw: string, rowNumber: number, column: string): number {
  const cleaned = raw.replace(/£/g, '').replace(/,/g, '').trim();
  if (cleaned === '') {
    throw new BookingDataError(`Row ${rowNumber}: ${column} is empty.`);
  }
  const value = Number(cleaned);
  if (!Number.isFinite(value)) {
    throw new BookingDataError(`Row ${rowNumber}: ${column} is "${raw}". Use a number.`);
  }
  return value;
}

function parseBooker(raw: string, rowNumber: number): BookerType {
  const value = raw.trim().toLowerCase();
  if ((BOOKER_TYPES as readonly string[]).includes(value)) {
    return value as BookerType;
  }
  throw new BookingDataError(
    `Row ${rowNumber}: booker_type is "${raw}". Use community, startup, company, or agency.`,
  );
}

function parseLabel(raw: string, rowNumber: number): DataLabel {
  if (raw.trim() === '') return 'UNSPECIFIED';
  const value = raw.trim().toUpperCase();
  if ((DATA_LABELS as readonly string[]).includes(value)) {
    return value as DataLabel;
  }
  throw new BookingDataError(
    `Row ${rowNumber}: data_label is "${raw}". Use SAMPLE, REAL, REDACTED, or leave the cell empty.`,
  );
}

function parseTiming(raw: string, rowNumber: number): { isEvening: boolean; isWeekend: boolean } {
  const value = normalizeHeader(raw);
  switch (value) {
    case 'weekday_day':
    case 'day':
    case 'daytime':
    case 'weekday':
      return { isEvening: false, isWeekend: false };
    case 'weekday_evening':
    case 'evening':
      return { isEvening: true, isWeekend: false };
    case 'weekend_day':
    case 'weekend':
      return { isEvening: false, isWeekend: true };
    case 'weekend_evening':
    case 'evening_weekend':
      return { isEvening: true, isWeekend: true };
    default:
      throw new BookingDataError(
        `Row ${rowNumber}: timing is "${raw}". Use weekday-day, weekday-evening, weekend-day, or weekend-evening.`,
      );
  }
}

function parseAvCatering(
  raw: string,
  rowNumber: number,
): { avNeeds: boolean; cateringNeeds: boolean } {
  const value = normalizeHeader(raw);
  switch (value) {
    case 'none':
    case 'no':
    case '':
      return { avNeeds: false, cateringNeeds: false };
    case 'av':
      return { avNeeds: true, cateringNeeds: false };
    case 'catering':
      return { avNeeds: false, cateringNeeds: true };
    case 'both':
    case 'av_catering':
    case 'av_and_catering':
      return { avNeeds: true, cateringNeeds: true };
    default:
      throw new BookingDataError(
        `Row ${rowNumber}: av_catering is "${raw}". Use none, av, catering, or both.`,
      );
  }
}

/**
 * Load bookings from CSV text.
 * The SAMPLE file and a real venue file use the same columns.
 * Extra columns are ignored. A `#` line is a comment.
 */
export function loadBookingsCsv(csvText: string): Booking[] {
  const table = parseCsv(csvText);
  if (table.length < 2) {
    throw new BookingDataError('The CSV has no booking rows.');
  }
  const headerRow = table[0];
  if (!headerRow) {
    throw new BookingDataError('The CSV has no header row.');
  }
  const headers = indexHeaders(headerRow);
  const columns = {
    bookingId: findColumn(headers, 'booking_id'),
    dataLabel: findColumn(headers, 'data_label'),
    venueName: findColumn(headers, 'venue_name'),
    date: findColumn(headers, 'date'),
    weekday: findColumn(headers, 'weekday'),
    isEvening: findColumn(headers, 'is_evening'),
    isWeekend: findColumn(headers, 'is_weekend'),
    timing: findColumn(headers, 'timing'),
    hours: findColumn(headers, 'hours'),
    headcount: findColumn(headers, 'headcount'),
    bookerType: findColumn(headers, 'booker_type'),
    bookerAlias: findColumn(headers, 'booker_alias'),
    repeat: findColumn(headers, 'repeat_booker_count'),
    broughtLeads: findColumn(headers, 'brought_leads'),
    avNeeds: findColumn(headers, 'av_needs'),
    cateringNeeds: findColumn(headers, 'catering_needs'),
    avCatering: findColumn(headers, 'av_catering'),
    price: findColumn(headers, 'price_paid_gbp'),
    free: findColumn(headers, 'free_community_slot'),
  };

  const missing: string[] = [];
  if (columns.date === undefined) missing.push('date');
  if (columns.hours === undefined) missing.push('hours');
  if (columns.headcount === undefined) missing.push('headcount');
  if (columns.bookerType === undefined) missing.push('booker_type');
  if (columns.repeat === undefined) missing.push('repeat_booker_count');
  if (columns.broughtLeads === undefined) missing.push('brought_leads');
  if (columns.price === undefined) missing.push('price_paid_gbp');
  if (columns.free === undefined) missing.push('free_community_slot');
  const hasFlags = columns.isEvening !== undefined && columns.isWeekend !== undefined;
  if (!hasFlags && columns.timing === undefined) {
    missing.push('is_evening and is_weekend (or one timing column)');
  }
  const hasAv = columns.avNeeds !== undefined && columns.cateringNeeds !== undefined;
  if (!hasAv && columns.avCatering === undefined) {
    missing.push('av_needs and catering_needs (or one av_catering column)');
  }
  if (missing.length > 0) {
    throw new BookingDataError(
      `The CSV is missing columns: ${missing.join(', ')}. Use the columns in the README. Canonical names: ${CANONICAL_COLUMNS.join(', ')}.`,
    );
  }

  const bookings: Booking[] = [];
  const seenIds = new Set<string>();

  for (let i = 1; i < table.length; i += 1) {
    const row = table[i];
    if (!row) continue;
    const rowNumber = i + 1;
    const date = parseIsoDate(cell(row, columns.date)).iso;
    const parsed = parseIsoDate(date);

    let isEvening: boolean;
    let isWeekend: boolean;
    if (columns.isEvening !== undefined && columns.isWeekend !== undefined) {
      isEvening = parseBool(cell(row, columns.isEvening), rowNumber, 'is_evening');
      isWeekend = parseBool(cell(row, columns.isWeekend), rowNumber, 'is_weekend');
    } else {
      const timing = parseTiming(cell(row, columns.timing), rowNumber);
      isEvening = timing.isEvening;
      isWeekend = timing.isWeekend;
    }

    const weekdayCell = cell(row, columns.weekday);
    let weekday: Weekday = parsed.weekday;
    if (weekdayCell !== '') {
      const match = parsed.weekday.toLowerCase() === weekdayCell.toLowerCase();
      if (!match) {
        throw new BookingDataError(
          `Row ${rowNumber}: weekday is ${weekdayCell}, but the date ${date} is a ${parsed.weekday}.`,
        );
      }
      weekday = parsed.weekday;
    }

    const hours = parseNumber(cell(row, columns.hours), rowNumber, 'hours');
    if (hours <= 0 || hours > 48) {
      throw new BookingDataError(`Row ${rowNumber}: hours must be greater than 0 and at most 48.`);
    }
    const headcount = parseNumber(cell(row, columns.headcount), rowNumber, 'headcount');
    if (!Number.isInteger(headcount) || headcount < 1 || headcount > 10000) {
      throw new BookingDataError(
        `Row ${rowNumber}: headcount must be a whole number from 1 to 10000.`,
      );
    }
    const repeatBookerCount = parseNumber(
      cell(row, columns.repeat),
      rowNumber,
      'repeat_booker_count',
    );
    if (!Number.isInteger(repeatBookerCount) || repeatBookerCount < 0) {
      throw new BookingDataError(
        `Row ${rowNumber}: repeat_booker_count must be a whole number of 0 or more.`,
      );
    }

    let avNeeds: boolean;
    let cateringNeeds: boolean;
    if (columns.avNeeds !== undefined && columns.cateringNeeds !== undefined) {
      avNeeds = parseBool(cell(row, columns.avNeeds), rowNumber, 'av_needs');
      cateringNeeds = parseBool(cell(row, columns.cateringNeeds), rowNumber, 'catering_needs');
    } else {
      const services = parseAvCatering(cell(row, columns.avCatering), rowNumber);
      avNeeds = services.avNeeds;
      cateringNeeds = services.cateringNeeds;
    }

    const bookerType = parseBooker(cell(row, columns.bookerType), rowNumber);
    const broughtLeads = parseBool(cell(row, columns.broughtLeads), rowNumber, 'brought_leads');
    const pricePaidGbp = parseNumber(cell(row, columns.price), rowNumber, 'price_paid_gbp');
    if (pricePaidGbp < 0) {
      throw new BookingDataError(`Row ${rowNumber}: price_paid_gbp must be 0 or more.`);
    }
    const freeCommunitySlot = parseBool(
      cell(row, columns.free),
      rowNumber,
      'free_community_slot',
    );
    if (freeCommunitySlot && bookerType !== 'community') {
      throw new BookingDataError(
        `Row ${rowNumber}: free_community_slot is y, but the booker type is ${bookerType}. Only a community booking can be a free community slot.`,
      );
    }
    if (freeCommunitySlot && pricePaidGbp !== 0) {
      throw new BookingDataError(
        `Row ${rowNumber}: free_community_slot is y, but price_paid_gbp is ${pricePaidGbp}. A free slot must have a price of 0.`,
      );
    }
    if (!freeCommunitySlot && pricePaidGbp === 0 && bookerType === 'community') {
      throw new BookingDataError(
        `Row ${rowNumber}: the community price is 0, but free_community_slot is n. Set the flag to y.`,
      );
    }

    const idCell = cell(row, columns.bookingId);
    const bookingId = idCell === '' ? `ROW-${String(i).padStart(3, '0')}` : idCell;
    if (seenIds.has(bookingId)) {
      throw new BookingDataError(`Row ${rowNumber}: booking_id "${bookingId}" is a duplicate.`);
    }
    seenIds.add(bookingId);

    const alias = cell(row, columns.bookerAlias);
    const venue = cell(row, columns.venueName);
    const booking: Booking = {
      bookingId,
      dataLabel: parseLabel(cell(row, columns.dataLabel), rowNumber),
      date,
      weekday,
      isEvening,
      isWeekend,
      hours,
      headcount,
      bookerType,
      repeatBookerCount,
      broughtLeads,
      avNeeds,
      cateringNeeds,
      pricePaidGbp,
      freeCommunitySlot,
    };
    if (alias !== '') booking.bookerAlias = alias;
    if (venue !== '') booking.venueName = venue;
    bookings.push(booking);
  }

  if (bookings.length === 0) {
    throw new BookingDataError('The CSV has no booking rows.');
  }
  return bookings;
}

/** Load bookings from a CSV file path. */
export function loadBookingsFile(path: string): Booking[] {
  const text = readFileSync(path, 'utf8');
  return loadBookingsCsv(text);
}
