import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { parseIsoDate } from '../src/dates.ts';
import { BookingDataError } from '../src/errors.ts';
import { loadBookingsCsv, loadBookingsFile } from '../src/load.ts';
import { compareBookings } from '../src/order.ts';
import { SAMPLE_CSV_PATH } from '../src/paths.ts';
import {
  SAMPLE_BOOKING_COUNT,
  SAMPLE_END_DATE,
  SAMPLE_START_DATE,
  SAMPLE_VENUE_NAME,
  generateSampleBookings,
} from '../src/sample/generate.ts';
import { SAMPLE_CSV_BANNER, bookingsToCsv } from '../src/serialize.ts';
import { summarizeHistory } from '../src/stats.ts';
import type { Booking, BookerType } from '../src/types.ts';

const history = generateSampleBookings();

test('the generator is deterministic and matches the SAMPLE file', () => {
  assert.deepEqual(generateSampleBookings(), history);
  assert.deepEqual(generateSampleBookings({ seed: 20261022, count: 300 }), history);
  const fromFile = loadBookingsFile(SAMPLE_CSV_PATH);
  assert.deepEqual(fromFile, history);
  assert.equal(readFileSync(SAMPLE_CSV_PATH, 'utf8'), bookingsToCsv(history));
  assert.ok(readFileSync(SAMPLE_CSV_PATH, 'utf8').startsWith(SAMPLE_CSV_BANNER));
});

test('every SAMPLE row is labelled and stays inside the date window', () => {
  assert.equal(history.length, SAMPLE_BOOKING_COUNT);
  for (const row of history) {
    assert.equal(row.dataLabel, 'SAMPLE');
    assert.equal(row.venueName, SAMPLE_VENUE_NAME);
    assert.ok(row.venueName.includes('SAMPLE'));
    assert.ok(row.date >= SAMPLE_START_DATE && row.date <= SAMPLE_END_DATE);
    const parsed = parseIsoDate(row.date);
    assert.equal(row.weekday, parsed.weekday);
    assert.equal(row.isWeekend, parsed.isCalendarWeekend);
    assert.ok(row.pricePaidGbp >= 0);
    assert.equal(row.pricePaidGbp % 5, 0);
    if (row.freeCommunitySlot) {
      assert.equal(row.bookerType, 'community');
      assert.equal(row.pricePaidGbp, 0);
    }
    if (row.pricePaidGbp === 0) {
      assert.equal(row.freeCommunitySlot, true);
      assert.equal(row.bookerType, 'community');
    }
    if (row.bookerType !== 'community') assert.ok(row.pricePaidGbp >= 50);
  }
});

test('the booker mix matches the written pattern', () => {
  const counts: Record<BookerType, number> = { community: 0, startup: 0, agency: 0, company: 0 };
  for (const row of history) counts[row.bookerType] += 1;
  assert.deepEqual(counts, { community: 168, startup: 60, agency: 42, company: 30 });
  const summary = summarizeHistory(history);
  assert.ok(summary.freeSlots > 40);
  assert.equal(summary.byType.community.freeSlots, summary.freeSlots);
  const communityMedian = summary.byType.community.medianGbp ?? 0;
  const startupMedian = summary.byType.startup.medianGbp ?? 0;
  const companyMedian = summary.byType.company.medianGbp ?? 0;
  assert.ok(communityMedian < startupMedian);
  assert.ok(startupMedian < companyMedian);
});

test('repeat counts follow the date order for each booker', () => {
  const groups = new Map<string, Booking[]>();
  for (const row of history) {
    const alias = row.bookerAlias ?? '';
    const list = groups.get(alias) ?? [];
    list.push(row);
    groups.set(alias, list);
  }
  let house = 0;
  for (const list of groups.values()) {
    const sorted = [...list].sort(compareBookings);
    sorted.forEach((row, index) => {
      assert.equal(row.repeatBookerCount, index);
    });
    const last = sorted[sorted.length - 1];
    if (last && last.bookerType === 'community' && last.repeatBookerCount >= 8) house += 1;
  }
  assert.ok(house >= 1);
  for (const row of history) {
    if (row.bookerType === 'company') assert.equal(row.repeatBookerCount, 0);
  }
});

test('a different seed changes the history', () => {
  const other = generateSampleBookings({ seed: 7 });
  assert.notDeepEqual(other, history);
});

test('the loader accepts a real-shaped CSV and rejects a bad one', () => {
  const csv = [
    'date,Weekday,is_evening,is_weekend,hours,headcount,booker_type,repeat_booker_count,brought_leads,av_needs,catering_needs,Price Paid (GBP),free_community_slot,data_label',
    '2026-03-04,Wednesday,n,n,8,40,company,0,n,y,y,"£3,200",n,REDACTED',
  ].join('\n');
  const rows = loadBookingsCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.pricePaidGbp, 3200);
  assert.equal(rows[0]?.dataLabel, 'REDACTED');
  assert.equal(rows[0]?.weekday, 'Wednesday');
  assert.equal(rows[0]?.bookingId, 'ROW-001');

  const timed = [
    'date,timing,hours,headcount,booker_type,repeat_booker_count,brought_leads,av_catering,price_paid_gbp,free_community_slot',
    '2026-05-02,weekend-evening,5,60,community,3,y,av,0,y',
  ].join('\n');
  const timedRows = loadBookingsCsv(timed);
  assert.equal(timedRows[0]?.isEvening, true);
  assert.equal(timedRows[0]?.isWeekend, true);
  assert.equal(timedRows[0]?.avNeeds, true);
  assert.equal(timedRows[0]?.cateringNeeds, false);
  assert.equal(timedRows[0]?.dataLabel, 'UNSPECIFIED');

  assert.throws(
    () => loadBookingsCsv('date,hours\n2026-01-01,4\n'),
    (error: unknown) => error instanceof BookingDataError && /missing columns/i.test(error.message),
  );
  assert.throws(
    () =>
      loadBookingsCsv(
        'date,is_evening,is_weekend,hours,headcount,booker_type,repeat_booker_count,brought_leads,av_needs,catering_needs,price_paid_gbp,free_community_slot\n2026-01-07,y,n,3,40,company,0,n,n,n,0,y\n',
      ),
    /Only a community/,
  );
  assert.throws(
    () =>
      loadBookingsCsv(
        'date,is_evening,is_weekend,hours,headcount,booker_type,repeat_booker_count,brought_leads,av_needs,catering_needs,price_paid_gbp,free_community_slot,weekday\n2026-11-12,y,n,3,40,community,0,y,n,n,0,y,Monday\n',
      ),
    /Thursday/,
  );
});

test('the quote modules do not import the SAMPLE tariff', () => {
  const files = [
    'quote.ts',
    'knn.ts',
    'gbdt.ts',
    'evaluate.ts',
    'explain.ts',
    'features.ts',
  ];
  for (const file of files) {
    const text = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.equal(text.includes('sample/tariff'), false, file);
    assert.equal(text.includes('priceFromTariff'), false, file);
  }
});
