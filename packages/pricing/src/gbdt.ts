import { bookingToFeatures, FEATURE_COUNT } from './features.js';
import { roundTo5 } from './money.js';
import { compareBookings } from './order.js';
import type { Booking, QuoteRequest } from './types.js';

/** Step size for each new tree. */
export const GBDT_LEARNING_RATE = 0.08;
export const GBDT_MAX_TREES = 160;
export const GBDT_MAX_DEPTH = 4;
export const GBDT_PATIENCE = 20;
/** A new best score must beat the old score by at least this many GBP. */
export const GBDT_MIN_IMPROVE_GBP = 0.5;

type Tree =
  | { kind: 'leaf'; value: number }
  | { kind: 'split'; feature: number; threshold: number; left: Tree; right: Tree };

export interface GbdtModel {
  trees: Tree[];
  /** Mean of log(1 + price) on the fit rows. */
  init: number;
  learningRate: number;
  featureCount: number;
}

function minLeafFor(rowCount: number): number {
  return Math.max(2, Math.min(5, Math.floor(rowCount / 12)));
}

function predictTree(tree: Tree, features: readonly number[]): number {
  let node = tree;
  while (node.kind === 'split') {
    node = (features[node.feature] ?? 0) <= node.threshold ? node.left : node.right;
  }
  return node.value;
}

function buildTree(
  features: readonly number[][],
  residual: readonly number[],
  indices: readonly number[],
  depth: number,
  minLeaf: number,
): Tree {
  const leaf = (): Tree => {
    let sum = 0;
    for (const index of indices) sum += residual[index] ?? 0;
    return { kind: 'leaf', value: indices.length === 0 ? 0 : sum / indices.length };
  };
  if (indices.length < minLeaf * 2 || depth >= GBDT_MAX_DEPTH) return leaf();

  let totalSum = 0;
  let totalSquare = 0;
  for (const index of indices) {
    const value = residual[index] ?? 0;
    totalSum += value;
    totalSquare += value * value;
  }
  const totalVar = totalSquare - (totalSum * totalSum) / indices.length;
  if (totalVar <= 1e-12) return leaf();

  let bestGain = 0;
  let bestFeature = -1;
  let bestThreshold = 0;

  for (let feature = 0; feature < FEATURE_COUNT; feature += 1) {
    const order = indices.slice().sort((left, right) => {
      const delta = (features[left]?.[feature] ?? 0) - (features[right]?.[feature] ?? 0);
      if (delta !== 0) return delta;
      return left - right;
    });
    const first = features[order[0] ?? 0]?.[feature] ?? 0;
    const last = features[order[order.length - 1] ?? 0]?.[feature] ?? 0;
    if (first === last) continue;

    let sumLeft = 0;
    let squareLeft = 0;
    let countLeft = 0;
    for (let position = 0; position < order.length - 1; position += 1) {
      const index = order[position] as number;
      const value = residual[index] ?? 0;
      sumLeft += value;
      squareLeft += value * value;
      countLeft += 1;
      const countRight = indices.length - countLeft;
      const leftValue = features[index]?.[feature] ?? 0;
      const rightValue = features[order[position + 1] as number]?.[feature] ?? 0;
      if (leftValue === rightValue) continue;
      if (countLeft < minLeaf || countRight < minLeaf) continue;
      const sumRight = totalSum - sumLeft;
      const squareRight = totalSquare - squareLeft;
      const varLeft = squareLeft - (sumLeft * sumLeft) / countLeft;
      const varRight = squareRight - (sumRight * sumRight) / countRight;
      const gain = totalVar - varLeft - varRight;
      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = feature;
        bestThreshold = leftValue;
      }
    }
  }

  if (bestFeature < 0) return leaf();
  const left: number[] = [];
  const right: number[] = [];
  for (const index of indices) {
    if ((features[index]?.[bestFeature] ?? 0) <= bestThreshold) left.push(index);
    else right.push(index);
  }
  if (left.length === 0 || right.length === 0) return leaf();
  return {
    kind: 'split',
    feature: bestFeature,
    threshold: bestThreshold,
    left: buildTree(features, residual, left, depth + 1, minLeaf),
    right: buildTree(features, residual, right, depth + 1, minLeaf),
  };
}

function gbpFromLog(logPrice: number): number {
  const price = Math.expm1(logPrice);
  if (!Number.isFinite(price)) return 0;
  return roundTo5(Math.max(0, price));
}

function maeOfLogPredictions(actualGbp: readonly number[], logPredictions: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < actualGbp.length; i += 1) {
    sum += Math.abs((actualGbp[i] as number) - gbpFromLog(logPredictions[i] as number));
  }
  return sum / actualGbp.length;
}

interface Matrix {
  features: number[][];
  logPrice: number[];
  price: number[];
}

function matrix(bookings: readonly Booking[]): Matrix {
  return {
    features: bookings.map((booking) => bookingToFeatures(booking)),
    logPrice: bookings.map((booking) => Math.log1p(booking.pricePaidGbp)),
    price: bookings.map((booking) => booking.pricePaidGbp),
  };
}

function growTrees(train: Matrix, treeCount: number): { trees: Tree[]; init: number } {
  const init = train.logPrice.reduce((sum, value) => sum + value, 0) / train.logPrice.length;
  const prediction = train.logPrice.map(() => init);
  const residual = new Array<number>(train.logPrice.length).fill(0);
  const trees: Tree[] = [];
  const minLeaf = minLeafFor(train.logPrice.length);
  const indices = train.features.map((_, index) => index);
  for (let treeIndex = 0; treeIndex < treeCount; treeIndex += 1) {
    for (let row = 0; row < residual.length; row += 1) {
      residual[row] = (train.logPrice[row] as number) - (prediction[row] as number);
    }
    const tree = buildTree(train.features, residual, indices, 0, minLeaf);
    trees.push(tree);
    for (let row = 0; row < prediction.length; row += 1) {
      prediction[row] =
        (prediction[row] as number) +
        GBDT_LEARNING_RATE * predictTree(tree, train.features[row] as number[]);
    }
  }
  return { trees, init };
}

function chooseTreeCount(fitRows: readonly Booking[], valRows: readonly Booking[]): number {
  const train = matrix(fitRows);
  const validation = matrix(valRows);
  const init = train.logPrice.reduce((sum, value) => sum + value, 0) / train.logPrice.length;
  const prediction = train.logPrice.map(() => init);
  const validationPrediction = validation.logPrice.map(() => init);
  const residual = new Array<number>(train.logPrice.length).fill(0);
  const minLeaf = minLeafFor(train.logPrice.length);
  const indices = train.features.map((_, index) => index);
  let bestCount = 0;
  let bestMae = maeOfLogPredictions(validation.price, validationPrediction);
  let wait = 0;

  for (let treeIndex = 0; treeIndex < GBDT_MAX_TREES; treeIndex += 1) {
    for (let row = 0; row < residual.length; row += 1) {
      residual[row] = (train.logPrice[row] as number) - (prediction[row] as number);
    }
    const tree = buildTree(train.features, residual, indices, 0, minLeaf);
    for (let row = 0; row < prediction.length; row += 1) {
      prediction[row] =
        (prediction[row] as number) +
        GBDT_LEARNING_RATE * predictTree(tree, train.features[row] as number[]);
    }
    for (let row = 0; row < validationPrediction.length; row += 1) {
      validationPrediction[row] =
        (validationPrediction[row] as number) +
        GBDT_LEARNING_RATE * predictTree(tree, validation.features[row] as number[]);
    }
    const err = maeOfLogPredictions(validation.price, validationPrediction);
    if (err < bestMae - GBDT_MIN_IMPROVE_GBP) {
      bestMae = err;
      bestCount = treeIndex + 1;
      wait = 0;
    } else {
      wait += 1;
      if (wait >= GBDT_PATIENCE) break;
    }
  }
  return bestCount;
}

/**
 * Fit gradient boosted trees.
 * The target is log(1 + price in GBP). The quote converts the result back to GBP.
 * Tree count is chosen on the last 15% of these rows by date, then the trees
 * are fit again on every row.
 */
export function fitGbdt(bookings: readonly Booking[]): GbdtModel {
  if (bookings.length < 4) {
    throw new Error('The gradient boosted model needs at least 4 bookings.');
  }
  const ordered = [...bookings].sort(compareBookings);
  const valCount = Math.max(1, Math.round(ordered.length * 0.15));
  const fitCount = ordered.length - valCount;
  let treeCount = Math.min(40, ordered.length);
  if (fitCount >= 8) {
    treeCount = chooseTreeCount(ordered.slice(0, fitCount), ordered.slice(fitCount));
  }
  const fitted = growTrees(matrix(ordered), treeCount);
  return {
    trees: fitted.trees,
    init: fitted.init,
    learningRate: GBDT_LEARNING_RATE,
    featureCount: FEATURE_COUNT,
  };
}

/** Predict a GBP price. The result is 0 or a multiple of £5. */
export function predictGbdtGbp(model: GbdtModel, request: QuoteRequest): number {
  const features = bookingToFeatures(request);
  let logPrice = model.init;
  for (const tree of model.trees) {
    logPrice += model.learningRate * predictTree(tree, features);
  }
  return gbpFromLog(logPrice);
}
