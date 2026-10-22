import { bookingToFeatures, CONTINUOUS_FEATURES, FEATURE_COUNT } from './features.js';
import { median as lowerMedian, percentileSorted } from './metrics.js';
import { roundTo5 } from './money.js';
import { compareBookings } from './order.js';
import type { Booking, Comparable, PriceRange, QuoteRequest } from './types.js';

/** The quote uses this many nearest past bookings of the same booker type. */
export const KNN_K = 8;

/**
 * Distance weights. A higher weight means the input changes the match more.
 * Booker-type weights matter only when the same type has fewer than 3 bookings.
 */
const WEIGHTS: readonly number[] = [
  1.5, 0.9, 0.85, 1.0, 0.85, 2.8, 0.45, 0.7, 1.25, 4, 4, 4, 4,
];

const MIN_SAME_TYPE = 3;
const DISTANCE_EPSILON = 0.35;
/**
 * A community that brings leads is quoted £0 when at least half of the
 * nearest community bookings were free slots.
 */
export const FREE_NEIGHBOR_FRACTION = 0.5;

export interface KnnModel {
  bookings: Booking[];
  vectors: number[][];
  k: number;
}

export interface KnnPrediction {
  price: number;
  range: PriceRange;
  comparables: Comparable[];
  /** True when the free-slot rule set the price to £0. */
  freeRule: boolean;
  weightedMedianGbp: number;
}

interface Neighbor {
  booking: Booking;
  distance: number;
  weight: number;
}

function fitScale(rows: readonly number[][]): { mean: number[]; std: number[] } {
  const mean = CONTINUOUS_FEATURES.map(() => 0);
  const std = CONTINUOUS_FEATURES.map(() => 1);
  const n = rows.length;
  CONTINUOUS_FEATURES.forEach((feature, index) => {
    let sum = 0;
    for (const row of rows) sum += row[feature] ?? 0;
    const mu = sum / n;
    mean[index] = mu;
    let square = 0;
    for (const row of rows) {
      const delta = (row[feature] ?? 0) - mu;
      square += delta * delta;
    }
    const sd = Math.sqrt(square / n);
    std[index] = sd < 1e-6 ? 1 : sd;
  });
  return { mean, std };
}

function scale(features: readonly number[], mean: readonly number[], std: readonly number[]): number[] {
  const out = features.slice();
  CONTINUOUS_FEATURES.forEach((feature, index) => {
    out[feature] = ((features[feature] ?? 0) - (mean[index] ?? 0)) / (std[index] ?? 1);
  });
  return out;
}

function distance(left: readonly number[], right: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < FEATURE_COUNT; i += 1) {
    const delta = (left[i] ?? 0) - (right[i] ?? 0);
    sum += (WEIGHTS[i] ?? 1) * delta * delta;
  }
  return Math.sqrt(sum);
}

function toComparable(neighbor: Neighbor): Comparable {
  const booking = neighbor.booking;
  return {
    bookingId: booking.bookingId,
    date: booking.date,
    weekday: booking.weekday,
    bookerType: booking.bookerType,
    isEvening: booking.isEvening,
    isWeekend: booking.isWeekend,
    hours: booking.hours,
    headcount: booking.headcount,
    repeatBookerCount: booking.repeatBookerCount,
    broughtLeads: booking.broughtLeads,
    avNeeds: booking.avNeeds,
    cateringNeeds: booking.cateringNeeds,
    pricePaidGbp: booking.pricePaidGbp,
    freeCommunitySlot: booking.freeCommunitySlot,
    distance: neighbor.distance,
    weight: neighbor.weight,
  };
}

function weightedMedian(neighbors: readonly Neighbor[]): number {
  const sorted = [...neighbors].sort(
    (a, b) => a.booking.pricePaidGbp - b.booking.pricePaidGbp || a.distance - b.distance,
  );
  const total = sorted.reduce((sum, neighbor) => sum + neighbor.weight, 0);
  let covered = 0;
  for (const neighbor of sorted) {
    covered += neighbor.weight;
    if (covered >= total / 2) return neighbor.booking.pricePaidGbp;
  }
  return sorted[sorted.length - 1]?.booking.pricePaidGbp ?? 0;
}

export function priceRange(price: number, comparables: readonly Comparable[]): PriceRange {
  const prices = comparables.map((row) => row.pricePaidGbp).sort((a, b) => a - b);
  const lowRaw = prices.length > 0 ? Math.min(percentileSorted(prices, 0.2), price) : price;
  const highRaw = prices.length > 0 ? Math.max(percentileSorted(prices, 0.8), price) : price;
  let low = roundTo5(Math.max(0, lowRaw));
  let high = roundTo5(Math.max(0, highRaw));
  if (low > price) low = price;
  if (high < price) high = price;
  if (high < low) high = low;
  return { low, high };
}

/** Fit the nearest-booking model on these rows. The rows are copied. */
export function fitKnn(bookings: readonly Booking[], k: number = KNN_K): KnnModel {
  if (bookings.length === 0) {
    throw new Error('The nearest-booking model needs at least one booking.');
  }
  const ordered = [...bookings].sort(compareBookings);
  const raw = ordered.map((booking) => bookingToFeatures(booking));
  const { mean, std } = fitScale(raw);
  return {
    bookings: ordered,
    vectors: raw.map((row) => scale(row, mean, std)),
    k: Math.max(1, Math.min(k, ordered.length)),
  };
}

export function predictKnn(model: KnnModel, request: QuoteRequest): KnnPrediction {
  const meanStd = recoverScale(model);
  const query = scale(bookingToFeatures(request), meanStd.mean, meanStd.std);
  const same: Neighbor[] = [];
  const other: Neighbor[] = [];
  for (let i = 0; i < model.bookings.length; i += 1) {
    const booking = model.bookings[i] as Booking;
    const vector = model.vectors[i] as number[];
    const dist = distance(query, vector);
    const neighbor: Neighbor = { booking, distance: dist, weight: 1 / (dist + DISTANCE_EPSILON) };
    if (booking.bookerType === request.bookerType) same.push(neighbor);
    else other.push(neighbor);
  }
  same.sort((a, b) => a.distance - b.distance || a.booking.bookingId.localeCompare(b.booking.bookingId));
  other.sort((a, b) => a.distance - b.distance || a.booking.bookingId.localeCompare(b.booking.bookingId));

  const used =
    same.length >= MIN_SAME_TYPE
      ? same.slice(0, Math.min(model.k, same.length))
      : [...same, ...other]
          .sort((a, b) => a.distance - b.distance || a.booking.bookingId.localeCompare(b.booking.bookingId))
          .slice(0, model.k);

  const freeCount = used.filter((neighbor) => neighbor.booking.freeCommunitySlot).length;
  const freeRule =
    request.bookerType === 'community' &&
    request.broughtLeads &&
    used.length > 0 &&
    freeCount / used.length >= FREE_NEIGHBOR_FRACTION;
  const weightedMedianGbp = used.length > 0 ? weightedMedian(used) : lowerMedian(model.bookings.map((row) => row.pricePaidGbp));
  const price = roundTo5(Math.max(0, freeRule ? 0 : weightedMedianGbp));
  const comparables = used.map(toComparable);
  return {
    price,
    range: priceRange(price, comparables),
    comparables,
    freeRule,
    weightedMedianGbp,
  };
}

/**
 * The stored vectors are already scaled. Rebuild mean and std from the raw
 * booking fields so a request uses the same scale as the fit.
 */
function recoverScale(model: KnnModel): { mean: number[]; std: number[] } {
  const raw = model.bookings.map((booking) => bookingToFeatures(booking));
  return fitScale(raw);
}
