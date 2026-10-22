import { median } from './metrics.js';
import { BOOKER_TYPES, type BookerType, type Booking } from './types.js';

export interface SegmentStats {
  count: number;
  freeSlots: number;
  medianGbp: number | null;
  paidMedianGbp: number | null;
}

export interface HistorySummary {
  count: number;
  freeSlots: number;
  byType: Record<BookerType, SegmentStats>;
}

function segment(rows: readonly Booking[]): SegmentStats {
  if (rows.length === 0) {
    return { count: 0, freeSlots: 0, medianGbp: null, paidMedianGbp: null };
  }
  const paid = rows.filter((row) => row.pricePaidGbp > 0).map((row) => row.pricePaidGbp);
  return {
    count: rows.length,
    freeSlots: rows.filter((row) => row.freeCommunitySlot).length,
    medianGbp: median(rows.map((row) => row.pricePaidGbp)),
    paidMedianGbp: paid.length > 0 ? median(paid) : null,
  };
}

export function summarizeHistory(history: readonly Booking[]): HistorySummary {
  const byType = {} as Record<BookerType, SegmentStats>;
  for (const bookerType of BOOKER_TYPES) {
    byType[bookerType] = segment(history.filter((row) => row.bookerType === bookerType));
  }
  return {
    count: history.length,
    freeSlots: history.filter((row) => row.freeCommunitySlot).length,
    byType,
  };
}
