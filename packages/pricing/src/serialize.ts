import { toCsv } from './csv.js';
import { CANONICAL_COLUMNS, type Booking } from './types.js';

export const SAMPLE_CSV_BANNER =
  '# SAMPLE fictional venue history. Not real bookings. Not a Night Office export.';

function yn(value: boolean): string {
  return value ? 'y' : 'n';
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

/** Write bookings as CSV. A file that is all SAMPLE rows gets a warning line. */
export function bookingsToCsv(bookings: readonly Booking[]): string {
  const rows = bookings.map((booking) => [
    booking.bookingId,
    booking.dataLabel,
    booking.venueName ?? '',
    booking.date,
    booking.weekday,
    yn(booking.isEvening),
    yn(booking.isWeekend),
    num(booking.hours),
    String(booking.headcount),
    booking.bookerType,
    booking.bookerAlias ?? '',
    String(booking.repeatBookerCount),
    yn(booking.broughtLeads),
    yn(booking.avNeeds),
    yn(booking.cateringNeeds),
    num(booking.pricePaidGbp),
    yn(booking.freeCommunitySlot),
  ]);
  const body = toCsv([[...CANONICAL_COLUMNS], ...rows]);
  const allSample = bookings.length > 0 && bookings.every((booking) => booking.dataLabel === 'SAMPLE');
  if (allSample) return `${SAMPLE_CSV_BANNER}\n${body}\n`;
  return `${body}\n`;
}
