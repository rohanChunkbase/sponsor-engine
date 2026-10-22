/** Round a GBP amount to the nearest £5. A value of 2.5 rounds away from zero. */
export function roundTo5(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error('The amount must be a finite number.');
  }
  return Math.round(amount / 5) * 5;
}

/** Format a GBP amount with a £ sign and thousands separators. No pence. */
export function formatGbp(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const body = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}£${body}`;
}
