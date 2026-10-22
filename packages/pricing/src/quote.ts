import { parseIsoDate } from './dates.js';
import { evaluatePricing, MIN_HISTORY, type EvaluationReport } from './evaluate.js';
import { BookingDataError } from './errors.js';
import { buildExplanation } from './explain.js';
import { fitGbdt, predictGbdtGbp, type GbdtModel } from './gbdt.js';
import { fitKnn, predictKnn, priceRange, type KnnModel } from './knn.js';
import { BOOKER_TYPES, type Booking, type ModelName, type Quote, type QuoteRequest } from './types.js';

export interface QuoteOptions {
  /** Use this method instead of the held-out winner. */
  model?: ModelName;
}

interface Fitted {
  fingerprint: string;
  report: EvaluationReport;
  knn: KnnModel;
  gbdt: GbdtModel;
}

const cache = new WeakMap<readonly Booking[], Fitted>();

function fingerprint(history: readonly Booking[]): string {
  let hash = history.length;
  for (const row of history) {
    hash = (Math.imul(hash, 33) + Math.round(row.pricePaidGbp)) | 0;
    hash = (Math.imul(hash, 33) + row.headcount) | 0;
    hash = (Math.imul(hash, 33) + Math.round(row.hours * 10)) | 0;
    hash = (Math.imul(hash, 33) + row.repeatBookerCount) | 0;
    hash = (Math.imul(hash, 33) + (row.broughtLeads ? 1 : 0)) | 0;
    hash = (Math.imul(hash, 33) + (row.isEvening ? 2 : 0) + (row.isWeekend ? 4 : 0)) | 0;
    hash = (Math.imul(hash, 33) + row.bookerType.charCodeAt(0)) | 0;
  }
  return String(hash);
}

function fitCached(history: readonly Booking[]): Fitted {
  const fp = fingerprint(history);
  const hit = cache.get(history);
  if (hit && hit.fingerprint === fp) return hit;
  const report = evaluatePricing(history);
  const fitted: Fitted = {
    fingerprint: fp,
    report,
    knn: fitKnn(history),
    gbdt: fitGbdt(history),
  };
  cache.set(history, fitted);
  return fitted;
}

function validateRequest(request: QuoteRequest): void {
  parseIsoDate(request.date);
  if (typeof request.isEvening !== 'boolean' || typeof request.isWeekend !== 'boolean') {
    throw new BookingDataError('isEvening and isWeekend must be true or false.');
  }
  if (!Number.isFinite(request.hours) || request.hours <= 0 || request.hours > 48) {
    throw new BookingDataError('hours must be greater than 0 and at most 48.');
  }
  if (!Number.isInteger(request.headcount) || request.headcount < 1 || request.headcount > 10000) {
    throw new BookingDataError('headcount must be a whole number from 1 to 10000.');
  }
  if (!Number.isInteger(request.repeatBookerCount) || request.repeatBookerCount < 0) {
    throw new BookingDataError('repeatBookerCount must be a whole number of 0 or more.');
  }
  if (typeof request.broughtLeads !== 'boolean') {
    throw new BookingDataError('broughtLeads must be true or false.');
  }
  if (typeof request.avNeeds !== 'boolean' || typeof request.cateringNeeds !== 'boolean') {
    throw new BookingDataError('avNeeds and cateringNeeds must be true or false.');
  }
  if (!(BOOKER_TYPES as readonly string[]).includes(request.bookerType)) {
    throw new BookingDataError('bookerType must be community, startup, company, or agency.');
  }
}

function validateHistory(history: readonly Booking[]): void {
  if (history.length < MIN_HISTORY) {
    throw new BookingDataError(
      `quotePrice needs at least ${MIN_HISTORY} past bookings. This history has ${history.length}.`,
    );
  }
  for (const row of history) {
    if (!Number.isFinite(row.pricePaidGbp) || row.pricePaidGbp < 0) {
      throw new BookingDataError(`Booking ${row.bookingId} has a price that is not valid.`);
    }
  }
}

/**
 * Quote one booking from a venue history.
 * The function fits both methods, scores them on a held-out 20% date split,
 * and uses the method with the lower MAE. The price is then fit on the full history.
 */
export function quotePrice(
  request: QuoteRequest,
  history: readonly Booking[],
  options?: QuoteOptions,
): Quote {
  validateRequest(request);
  validateHistory(history);
  const fitted = fitCached(history);
  const modelName = options?.model ?? fitted.report.winner;
  const knn = predictKnn(fitted.knn, request);
  const gbdtPrice = predictGbdtGbp(fitted.gbdt, request);
  const price = modelName === 'gbdt' ? gbdtPrice : knn.price;
  const range = priceRange(price, knn.comparables);
  const explanation = buildExplanation({
    request,
    history,
    price,
    range,
    comparables: knn.comparables,
    modelName,
    report: fitted.report,
    knnPrice: knn.price,
    gbdtPrice,
    freeRule: knn.freeRule && modelName === 'knn-rules',
  });
  return {
    price,
    currency: 'GBP',
    range,
    explanation,
    comparables: knn.comparables,
  };
}
