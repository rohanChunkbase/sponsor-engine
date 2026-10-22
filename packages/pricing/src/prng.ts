/**
 * Deterministic generator in the unit interval [0, 1).
 * The same seed always returns the same sequence.
 */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randInt(rng: () => number, minInclusive: number, maxInclusive: number): number {
  const span = maxInclusive - minInclusive + 1;
  return minInclusive + Math.floor(rng() * span);
}

/** Triangular distribution. min, mode, and max are inclusive bounds. */
export function triangular(
  rng: () => number,
  min: number,
  mode: number,
  max: number,
): number {
  if (!(min <= mode && mode <= max) || max === min) {
    throw new Error('The triangular bounds are not valid.');
  }
  const u = rng();
  const cut = (mode - min) / (max - min);
  if (u < cut) {
    return min + Math.sqrt(u * (max - min) * (mode - min));
  }
  return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

export function shuffleInPlace<T>(items: T[], rng: () => number): void {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const swap = items[i];
    items[i] = items[j] as T;
    items[j] = swap as T;
  }
}
