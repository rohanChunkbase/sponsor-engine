import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  comparableEveningRooms,
  isMarketOutlier,
  loadLondonMarket,
  MARKET_EVENING_HIGH_GBP,
  MARKET_EVENING_LOW_GBP,
  MARKET_EVENING_MEDIAN_GBP,
  marketCheck,
  marketSentence,
  parseCapacity,
} from '../src/market.ts';

test('capacity text uses the standing count when the page gives one', () => {
  assert.equal(parseCapacity('45 seated / 80 standing'), 80);
  assert.equal(parseCapacity('120 theatre / 150 standing / 65 cabaret'), 150);
  assert.equal(parseCapacity('90 standing'), 90);
  assert.equal(parseCapacity('900 reception / 550 theatre'), 900);
  assert.equal(parseCapacity('100 guests'), 100);
  assert.equal(parseCapacity('70'), 70);
  assert.equal(
    parseCapacity('up to 50 standing (Huckletree site says 70 standing / 40 seated)'),
    70,
  );
  assert.equal(parseCapacity('60 standing / 40 seated (bar & lounge 120)'), 60);
  assert.equal(parseCapacity('not stated'), null);
  assert.equal(parseCapacity('varies'), null);
});

test('the public file has 20 comparable evening rows and leaves out the two large rooms', () => {
  const rooms = loadLondonMarket();
  assert.ok(rooms.length >= 35);
  assert.ok(rooms.every((room) => room.url.startsWith('http')));
  const comparable = comparableEveningRooms(rooms);
  assert.equal(comparable.length, 20);
  const prices = comparable.map((room) => room.price ?? 0).sort((a, b) => a - b);
  assert.equal(prices[0], MARKET_EVENING_LOW_GBP);
  assert.equal(prices[prices.length - 1], MARKET_EVENING_HIGH_GBP);
  // 20 prices. The median is the average of the two middle prices, £1,300 and £1,400.
  assert.equal(((prices[9] ?? 0) + (prices[10] ?? 0)) / 2, MARKET_EVENING_MEDIAN_GBP);
  assert.equal(
    comparable.some((room) => room.normMethod.toLowerCase().includes('minimum spend')),
    false,
  );
  assert.equal(
    rooms.some(
      (room) =>
        isMarketOutlier(room.venue, room.space) && room.price !== null && room.comparable,
    ),
    false,
  );
  assert.ok(rooms.some((room) => isMarketOutlier(room.venue, room.space) && room.price === 25000));
  assert.ok(rooms.some((room) => isMarketOutlier(room.venue, room.space) && room.price === 16800));
});

test('marketCheck places a quote among similar rooms and returns three venues', () => {
  const check = marketCheck(1545, 80);
  assert.equal(check.quote, 1545);
  assert.equal(check.capacity, 80);
  assert.equal(check.nearest.length, 3);
  assert.ok(check.comparedCount >= 3);
  assert.ok(check.percentile >= 0 && check.percentile <= 100);
  assert.ok(check.low <= check.high);
  assert.ok(check.low >= MARKET_EVENING_LOW_GBP);
  assert.ok(check.high <= MARKET_EVENING_HIGH_GBP);
  for (const room of check.nearest) {
    assert.ok(room.name.length > 0);
    assert.ok(room.price > 0);
    assert.ok(room.url.startsWith('https://'));
    assert.ok(Math.abs(room.capacity - 80) <= 30);
    assert.equal(room.name.includes('Tobacco Dock'), false);
    assert.equal(room.name.includes('River Terrace'), false);
  }
  const above = marketCheck(50000, 80);
  assert.equal(above.percentile, 100);
  const below = marketCheck(0, 80);
  assert.equal(below.percentile, 0);
  assert.ok(below.low < below.high || below.nearest.length === 1);
});

test('the market sentence names published rooms and marks a longer booking', () => {
  const evening = marketCheck(1545, 80);
  const eveningSentence = marketSentence(
    {
      date: '2026-11-19',
      isEvening: true,
      isWeekend: false,
      hours: 4,
      headcount: 80,
      bookerType: 'company',
      repeatBookerCount: 0,
      broughtLeads: false,
      avNeeds: true,
      cateringNeeds: false,
    },
    evening,
  );
  assert.match(
    eveningSentence,
    /^A company evening for 80 here is £1,545; similar London rooms publish £[\d,]+ to £[\d,]+ \(/,
  );
  assert.equal(eveningSentence.includes('for about 4 evening hours'), false);
  const priced = [...evening.nearest].sort((left, right) => left.price - right.price);
  const lowRoom = priced[0];
  const highRoom = priced[priced.length - 1];
  assert.ok(lowRoom && highRoom);
  assert.ok(eveningSentence.includes(lowRoom.name));
  assert.ok(eveningSentence.includes(highRoom.name));

  const day = marketCheck(1800, 45);
  const daySentence = marketSentence(
    {
      date: '2026-11-18',
      isEvening: false,
      isWeekend: false,
      hours: 8,
      headcount: 45,
      bookerType: 'company',
      repeatBookerCount: 0,
      broughtLeads: false,
      avNeeds: true,
      cateringNeeds: true,
    },
    day,
  );
  assert.match(daySentence, /for about 4 evening hours/);
  assert.match(daySentence, /^A company day for 45 here is £1,800;/);
});
