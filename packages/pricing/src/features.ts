import type { BookerType, Booking, QuoteRequest } from './types.js';

/**
 * Model inputs. The order is fixed.
 * Trees and the nearest-booking model both use this list.
 * The list does not include the price and does not include the free-slot flag.
 */
export const FEATURE_NAMES = [
  'hours',
  'headcount',
  'is_evening',
  'is_weekend',
  'repeat_booker_count',
  'brought_leads',
  'av_needs',
  'catering_needs',
  'catering_covers',
  'booker_community',
  'booker_startup',
  'booker_company',
  'booker_agency',
] as const;

export const FEATURE_COUNT = FEATURE_NAMES.length;

/** Continuous inputs. The nearest-booking model scales these. Trees do not. */
export const CONTINUOUS_FEATURES = [0, 1, 4, 8] as const;

const BOOKER_FEATURE: Record<BookerType, number> = {
  community: 9,
  startup: 10,
  company: 11,
  agency: 12,
};

export function bookingToFeatures(row: QuoteRequest | Booking): number[] {
  const features = new Array<number>(FEATURE_COUNT).fill(0);
  features[0] = row.hours;
  features[1] = row.headcount;
  features[2] = row.isEvening ? 1 : 0;
  features[3] = row.isWeekend ? 1 : 0;
  features[4] = row.repeatBookerCount;
  features[5] = row.broughtLeads ? 1 : 0;
  features[6] = row.avNeeds ? 1 : 0;
  features[7] = row.cateringNeeds ? 1 : 0;
  features[8] = row.cateringNeeds ? row.headcount : 0;
  const bookerIndex = BOOKER_FEATURE[row.bookerType];
  features[bookerIndex] = 1;
  return features;
}
