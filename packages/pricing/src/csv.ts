import { BookingDataError } from './errors.js';

/** Parse CSV text. Quoted commas and quotes are supported. `#` rows are comments. */
export function parseCsv(text: string): string[][] {
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (inQuotes) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      continue;
    }
    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (char === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      continue;
    }
    if (char === '\r') continue;
    field += char;
  }

  if (inQuotes) {
    throw new BookingDataError('The CSV has a quote that does not close.');
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => {
    if (cells.length === 1 && (cells[0] ?? '').trim() === '') return false;
    const first = (cells[0] ?? '').trim();
    if (first.startsWith('#')) return false;
    return true;
  });
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(rows: readonly (readonly string[])[]): string {
  return rows.map((row) => row.map((cell) => csvEscape(cell)).join(',')).join('\n');
}

/** Normalize a header so `Price Paid (GBP)` and `price_paid_gbp` match. */
export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/[()]/g, '')
    .replace(/[/\s-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}
