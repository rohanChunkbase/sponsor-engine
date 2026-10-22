import { predictGbdtGbp, fitGbdt } from './gbdt.js';
import { fitKnn, KNN_K, predictKnn } from './knn.js';
import { meanAbsoluteError, meanAbsolutePercentageError, median } from './metrics.js';
import { compareBookings } from './order.js';
import type { Booking, ModelName } from './types.js';
import { BookingDataError } from './errors.js';

export const HOLDOUT_FRACTION = 0.2;
export const MIN_HISTORY = 10;

export const SELECTION_RULE =
  'The winner is the method with the lower MAE on the held-out rows. If the MAE values are equal, the winner is the method with the lower MAPE. If the values are still equal, the winner is the nearest-booking method. The constant median is a baseline only. The median cannot win.';

export interface ModelScore {
  model: ModelName | 'median';
  maeGbp: number;
  /** Percent. Rows with a price of £0 are omitted. */
  mapePercent: number;
  paidRows: number;
  testRows: number;
  freeSlotsCorrect: number;
  freeSlotRows: number;
  paidPredictedFree: number;
  detail: string;
}

export interface DatedSplit {
  train: Booking[];
  test: Booking[];
}

export interface EvaluationReport {
  historyCount: number;
  trainCount: number;
  testCount: number;
  split: 'last-20-percent-by-date';
  scores: ModelScore[];
  baselineMedian: ModelScore;
  winner: ModelName;
  selectionRule: string;
}

export function splitHistoryByDate(
  history: readonly Booking[],
  testFraction: number = HOLDOUT_FRACTION,
): DatedSplit {
  if (history.length < MIN_HISTORY) {
    throw new BookingDataError(
      `The history must contain at least ${MIN_HISTORY} bookings. This history has ${history.length}.`,
    );
  }
  const sorted = [...history].sort(compareBookings);
  const testCount = Math.max(1, Math.round(sorted.length * testFraction));
  if (testCount >= sorted.length) {
    throw new BookingDataError('The held-out split left no bookings for the fit.');
  }
  return {
    train: sorted.slice(0, sorted.length - testCount),
    test: sorted.slice(sorted.length - testCount),
  };
}

function scoreRows(
  model: ModelScore['model'],
  test: readonly Booking[],
  predicted: readonly number[],
  detail: string,
): ModelScore {
  const actual = test.map((row) => row.pricePaidGbp);
  let freeSlotsCorrect = 0;
  let freeSlotRows = 0;
  let paidPredictedFree = 0;
  for (let i = 0; i < test.length; i += 1) {
    const row = test[i] as Booking;
    const price = predicted[i] as number;
    if (row.freeCommunitySlot) {
      freeSlotRows += 1;
      if (price === 0) freeSlotsCorrect += 1;
    } else if (price === 0) {
      paidPredictedFree += 1;
    }
  }
  return {
    model,
    maeGbp: meanAbsoluteError(actual, predicted),
    mapePercent: meanAbsolutePercentageError(actual, predicted),
    paidRows: actual.filter((price) => price > 0).length,
    testRows: test.length,
    freeSlotsCorrect,
    freeSlotRows,
    paidPredictedFree,
    detail,
  };
}

function prefer(left: ModelScore, right: ModelScore): ModelScore {
  if (left.maeGbp < right.maeGbp - 1e-9) return left;
  if (right.maeGbp < left.maeGbp - 1e-9) return right;
  const leftMape = Number.isNaN(left.mapePercent) ? Number.POSITIVE_INFINITY : left.mapePercent;
  const rightMape = Number.isNaN(right.mapePercent) ? Number.POSITIVE_INFINITY : right.mapePercent;
  if (leftMape < rightMape) return left;
  if (rightMape < leftMape) return right;
  return left.model === 'knn-rules' ? left : right;
}

/**
 * Fit both methods on the earlier bookings. Score both methods on the later bookings.
 * The later block is 20% of the rows after a date sort.
 */
export function evaluatePricing(history: readonly Booking[]): EvaluationReport {
  const { train, test } = splitHistoryByDate(history);
  const knn = fitKnn(train, KNN_K);
  const gbdt = fitGbdt(train);
  const knnScore = scoreRows(
    'knn-rules',
    test,
    test.map((row) => predictKnn(knn, row).price),
    `k=${knn.k}, same booker type, weighted median, free-slot rule when the booker brings leads and at least half of the neighbors were free`,
  );
  const gbdtScore = scoreRows(
    'gbdt',
    test,
    test.map((row) => predictGbdtGbp(gbdt, row)),
    `trees=${gbdt.trees.length}, learning rate=${gbdt.learningRate}, target=log(1+price)`,
  );
  const trainMedian = median(train.map((row) => row.pricePaidGbp));
  const baselineMedian = scoreRows(
    'median',
    test,
    test.map(() => trainMedian),
    'one price for every request: the median price in the fit rows',
  );
  const winnerScore = prefer(knnScore, gbdtScore);
  const winner = winnerScore.model === 'gbdt' ? 'gbdt' : 'knn-rules';
  return {
    historyCount: history.length,
    trainCount: train.length,
    testCount: test.length,
    split: 'last-20-percent-by-date',
    scores: [knnScore, gbdtScore],
    baselineMedian,
    winner,
    selectionRule: SELECTION_RULE,
  };
}
