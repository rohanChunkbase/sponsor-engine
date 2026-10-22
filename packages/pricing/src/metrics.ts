/** Mean absolute error, in the same units as the inputs. */
export function meanAbsoluteError(actual: readonly number[], predicted: readonly number[]): number {
  if (actual.length === 0) {
    throw new Error('MAE needs at least one row.');
  }
  if (actual.length !== predicted.length) {
    throw new Error('MAE needs two lists of the same length.');
  }
  let sum = 0;
  for (let i = 0; i < actual.length; i += 1) {
    sum += Math.abs((actual[i] as number) - (predicted[i] as number));
  }
  return sum / actual.length;
}

/**
 * Mean absolute percentage error, as a percent (12.5 means 12.5%).
 * Rows with an actual price of 0 are omitted. A free slot has no percentage.
 * Returns NaN when every actual price is 0.
 */
export function meanAbsolutePercentageError(
  actual: readonly number[],
  predicted: readonly number[],
): number {
  if (actual.length !== predicted.length) {
    throw new Error('MAPE needs two lists of the same length.');
  }
  let sum = 0;
  let count = 0;
  for (let i = 0; i < actual.length; i += 1) {
    const truth = actual[i] as number;
    if (truth === 0) continue;
    sum += Math.abs(truth - (predicted[i] as number)) / Math.abs(truth);
    count += 1;
  }
  if (count === 0) return Number.NaN;
  return (sum / count) * 100;
}

/** Lower median. The result is one of the input values. */
export function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new Error('The median needs at least one value.');
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)] as number;
}

/**
 * Percentile on a list that is already sorted in ascending order.
 * `p` is from 0 to 1. The result is one of the input values.
 */
export function percentileSorted(sortedAsc: readonly number[], p: number): number {
  if (sortedAsc.length === 0) {
    throw new Error('The percentile needs at least one value.');
  }
  const clamped = Math.min(1, Math.max(0, p));
  const index = Math.round((sortedAsc.length - 1) * clamped);
  return sortedAsc[index] as number;
}
