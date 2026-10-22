import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseIsoDate } from '../src/dates.ts';
import { evaluatePricing, splitHistoryByDate } from '../src/evaluate.ts';
import { EXAMPLE_REQUESTS } from '../src/examples.ts';
import { meanAbsoluteError, meanAbsolutePercentageError } from '../src/metrics.ts';
import { generateSampleBookings } from '../src/sample/generate.ts';
import { quotePrice } from '../src/quote.ts';
import type { Booking, BookerType } from '../src/types.ts';

const history = generateSampleBookings();

test('the held-out split is the last 20 percent by date', () => {
  const split = splitHistoryByDate(history);
  assert.equal(split.train.length, 240);
  assert.equal(split.test.length, 60);
  const trainIds = new Set(split.train.map((row) => row.bookingId));
  for (const row of split.test) assert.equal(trainIds.has(row.bookingId), false);
  const lastTrain = split.train[split.train.length - 1];
  const firstTest = split.test[0];
  assert.ok(lastTrain && firstTest);
  assert.ok(lastTrain.date <= firstTest.date);
});

test('MAE and MAPE match a hand calculation', () => {
  assert.equal(meanAbsoluteError([0, 100, 200], [0, 110, 180]), 10);
  assert.equal(meanAbsolutePercentageError([0, 100, 200], [0, 110, 180]), 10);
});

test('the winning method beats a constant median on the held-out rows', () => {
  const report = evaluatePricing(history);
  const winner = report.scores.find((score) => score.model === report.winner);
  const knn = report.scores.find((score) => score.model === 'knn-rules');
  const gbdt = report.scores.find((score) => score.model === 'gbdt');
  assert.ok(winner && knn && gbdt);
  assert.equal(report.winner, 'knn-rules');
  assert.ok(Math.abs(knn.maeGbp - 76.91666666666667) < 1e-9);
  assert.ok(Math.abs(knn.mapePercent - 15.923282804567842) < 1e-9);
  assert.ok(Math.abs(gbdt.maeGbp - 96.75) < 1e-9);
  assert.ok(Math.abs(gbdt.mapePercent - 12.992102355387905) < 1e-9);
  assert.equal(knn.freeSlotsCorrect, 22);
  assert.equal(knn.freeSlotRows, 23);
  assert.equal(knn.paidPredictedFree, 0);
  assert.ok(winner.maeGbp < report.baselineMedian.maeGbp * 0.25);
  assert.equal(report.testCount, 60);
  assert.equal(report.trainCount, 240);
  assert.equal(report.baselineMedian.paidRows, 37);
});

test('the three example quotes are ordered and explained', () => {
  const [communityExample, startupExample, companyExample] = EXAMPLE_REQUESTS;
  assert.ok(communityExample && startupExample && companyExample);
  assert.equal(parseIsoDate(communityExample.request.date).weekday, 'Thursday');
  assert.equal(parseIsoDate(companyExample.request.date).weekday, 'Wednesday');
  assert.equal(parseIsoDate(startupExample.request.date).weekday, 'Thursday');
  for (const example of EXAMPLE_REQUESTS) {
    assert.ok(example.request.date > '2026-09-30');
  }

  const order = history.map((row) => row.bookingId).join(',');
  const community = quotePrice(communityExample.request, history);
  const startup = quotePrice(startupExample.request, history);
  const company = quotePrice(companyExample.request, history);
  assert.equal(history.map((row) => row.bookingId).join(','), order);

  assert.equal(community.currency, 'GBP');
  assert.equal(startup.currency, 'GBP');
  assert.equal(company.currency, 'GBP');
  assert.equal(community.price, 0);
  assert.ok(startup.price > community.price);
  assert.ok(company.price > startup.price);
  assert.ok(startup.price >= 600 && startup.price <= 2800);
  assert.ok(company.price >= 2500 && company.price <= 7000);

  for (const quote of [community, startup, company]) {
    assert.ok(quote.range.low <= quote.price && quote.price <= quote.range.high);
    assert.ok(quote.comparables.length >= 3 && quote.comparables.length <= 8);
    assert.match(quote.explanation, /community/i);
    assert.match(quote.explanation, /company/i);
    assert.match(quote.explanation, /discount|free slot/i);
    assert.match(quote.explanation, /B\d{3}/);
    assert.match(quote.explanation, /MAE/);
    assert.match(quote.explanation, /MAPE/);
    for (const comparable of quote.comparables) {
      assert.ok(history.some((row) => row.bookingId === comparable.bookingId));
      assert.ok(comparable.distance >= 0);
    }
  }
  assert.match(community.explanation, /free slot/i);
  assert.match(company.explanation, /full price/i);
  assert.ok(community.comparables.every((row) => row.bookerType === 'community'));
  assert.ok(company.comparables.every((row) => row.bookerType === 'company'));
});

test('a short history still returns a GBP quote', () => {
  const rows: Booking[] = [];
  const types: BookerType[] = ['community', 'community', 'startup', 'company', 'agency'];
  for (let index = 0; index < 12; index += 1) {
    const bookerType = types[index % types.length] as BookerType;
    const free = bookerType === 'community' && index % 2 === 0;
    const day = String(index + 1).padStart(2, '0');
    const date = `2025-06-${day}`;
    rows.push({
      bookingId: `T${day}`,
      dataLabel: 'UNSPECIFIED',
      date,
      weekday: parseIsoDate(date).weekday,
      isEvening: true,
      isWeekend: false,
      hours: 4,
      headcount: 30 + index,
      bookerType,
      repeatBookerCount: 0,
      broughtLeads: bookerType === 'community',
      avNeeds: false,
      cateringNeeds: bookerType === 'company',
      pricePaidGbp: free ? 0 : 200 * (index + 1),
      freeCommunitySlot: free,
    });
  }
  const quote = quotePrice(
    {
      date: '2026-07-09',
      isEvening: true,
      isWeekend: false,
      hours: 4,
      headcount: 40,
      bookerType: 'startup',
      repeatBookerCount: 0,
      broughtLeads: false,
      avNeeds: false,
      cateringNeeds: false,
    },
    rows,
  );
  assert.equal(quote.currency, 'GBP');
  assert.ok(quote.price >= 0);
  assert.ok(quote.comparables.length >= 1);
});
