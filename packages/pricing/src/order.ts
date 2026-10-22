import type { Booking } from './types.js';

/** Date order, then booking id. The held-out split uses this order. */
export function compareBookings(a: Booking, b: Booking): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.bookingId !== b.bookingId) return a.bookingId < b.bookingId ? -1 : 1;
  return 0;
}
