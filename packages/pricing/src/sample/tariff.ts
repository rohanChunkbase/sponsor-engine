import { roundTo5 } from '../money.js';
import type { BookerType } from '../types.js';

/**
 * SAMPLE tariff for the fictional venue Riverworks Hall.
 * The quote model does not import this file.
 * The generator uses this file to build fictional prices.
 *
 * The steps match the README. If you change a number here, change the README.
 */

export const HOURLY_GBP = {
  weekdayDay: 150,
  weekdayEvening: 220,
  weekendDay: 200,
  weekendEvening: 280,
} as const;

export const PEOPLE_FEE_GBP = [
  { maxHeadcount: 70, fee: 0 },
  { maxHeadcount: 110, fee: 250 },
  { maxHeadcount: 160, fee: 550 },
  { maxHeadcount: Number.POSITIVE_INFINITY, fee: 900 },
] as const;

export const AV_FEE_GBP = 240;

export const CATERING_PER_HEAD_GBP: Record<BookerType, number> = {
  community: 0,
  startup: 9,
  agency: 18,
  company: 32,
};

export const HIRE_FACTOR: Record<BookerType, number> = {
  community: 0.18,
  startup: 0.5,
  agency: 1.05,
  company: 1.75,
};

export const REPEAT_DISCOUNT_PER_BOOKING = 0.025;
export const REPEAT_DISCOUNT_CAP = 0.15;

export const LEAD_DISCOUNT: Record<BookerType, number> = {
  community: 0.55,
  startup: 0.1,
  agency: 0.04,
  company: 0.04,
};

/** A community total at or below this value, before noise, is a free slot. */
export const COMMUNITY_FREE_AT_OR_BELOW_GBP = 100;

export const NOISE_FRACTION = 0.04;
export const MANUAL_OVERRIDE_RATE = 0.05;
export const MANUAL_OVERRIDE_FRACTION = 0.12;
export const COMMERCIAL_MINIMUM_GBP = 50;

export interface TariffInput {
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

export interface TariffPrice {
  pricePaidGbp: number;
  freeCommunitySlot: boolean;
  /** The price after the written rules and before noise and rounding. */
  priceBeforeNoiseGbp: number;
}

function hourlyRate(input: TariffInput): number {
  if (input.isWeekend && input.isEvening) return HOURLY_GBP.weekendEvening;
  if (input.isWeekend) return HOURLY_GBP.weekendDay;
  if (input.isEvening) return HOURLY_GBP.weekdayEvening;
  return HOURLY_GBP.weekdayDay;
}

function peopleFee(headcount: number): number {
  for (const band of PEOPLE_FEE_GBP) {
    if (headcount <= band.maxHeadcount) return band.fee;
  }
  return 900;
}

function isFreeByRule(input: TariffInput): boolean {
  if (input.bookerType !== 'community' || !input.broughtLeads) return false;
  if (input.repeatBookerCount >= 8) return true;
  return input.hours <= 5 && input.headcount <= 110;
}

/**
 * Price one SAMPLE booking.
 * Pass `rng` to apply the small noise term and the rare manual change.
 * Omit `rng` to get the written tariff after rounding to £5.
 */
export function priceFromTariff(
  input: TariffInput,
  rng?: () => number,
): TariffPrice {
  const room = hourlyRate(input) * input.hours;
  const hireBase = room + peopleFee(input.headcount) + (input.avNeeds ? AV_FEE_GBP : 0);
  const repeatDiscount = Math.min(
    REPEAT_DISCOUNT_CAP,
    REPEAT_DISCOUNT_PER_BOOKING * input.repeatBookerCount,
  );
  let hire = hireBase * HIRE_FACTOR[input.bookerType] * (1 - repeatDiscount);
  if (input.broughtLeads) {
    hire *= 1 - LEAD_DISCOUNT[input.bookerType];
  }
  const catering = input.cateringNeeds
    ? CATERING_PER_HEAD_GBP[input.bookerType] * input.headcount
    : 0;
  let beforeNoise = hire + catering;

  if (isFreeByRule(input) || (input.bookerType === 'community' && beforeNoise <= COMMUNITY_FREE_AT_OR_BELOW_GBP)) {
    return { pricePaidGbp: 0, freeCommunitySlot: true, priceBeforeNoiseGbp: 0 };
  }

  let price = beforeNoise;
  if (rng) {
    const noise = 1 + (rng() - 0.5) * (NOISE_FRACTION * 2);
    price *= noise;
    if (rng() < MANUAL_OVERRIDE_RATE) {
      price *= rng() < 0.5 ? 1 - MANUAL_OVERRIDE_FRACTION : 1 + MANUAL_OVERRIDE_FRACTION;
    }
  }
  price = roundTo5(Math.max(0, price));
  if (input.bookerType !== 'community') {
    price = Math.max(COMMERCIAL_MINIMUM_GBP, price);
  }
  if (price === 0) {
    return { pricePaidGbp: 0, freeCommunitySlot: true, priceBeforeNoiseGbp: beforeNoise };
  }
  return { pricePaidGbp: price, freeCommunitySlot: false, priceBeforeNoiseGbp: beforeNoise };
}
