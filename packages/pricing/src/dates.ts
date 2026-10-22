export const WEEKDAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface ParsedDate {
  iso: string;
  year: number;
  month: number;
  day: number;
  weekday: Weekday;
  weekdayIndex: number;
  isCalendarWeekend: boolean;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse a calendar date. The time zone is UTC, so the weekday does not shift. */
export function parseIsoDate(iso: string): ParsedDate {
  const match = DATE_RE.exec(iso);
  if (!match) {
    throw new Error(`The date "${iso}" must use the form YYYY-MM-DD.`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`The date "${iso}" is not a real calendar date.`);
  }
  const weekdayIndex = utc.getUTCDay();
  const weekday = WEEKDAYS[weekdayIndex];
  if (!weekday) {
    throw new Error(`The date "${iso}" has no weekday.`);
  }
  return {
    iso,
    year,
    month,
    day,
    weekday,
    weekdayIndex,
    isCalendarWeekend: weekdayIndex === 0 || weekdayIndex === 6,
  };
}

export function compareIsoDates(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
