import assert from 'node:assert/strict';
import { test } from 'node:test';

import { generateSampleBookings } from '../src/sample/generate.ts';
import { priceFromTariff } from '../src/sample/tariff.ts';
import { MARKET_EVENING_HIGH_GBP, MARKET_EVENING_LOW_GBP } from '../src/market.ts';

const companyDay = {
  isEvening: false,
  isWeekend: false,
  hours: 8,
  headcount: 45,
  bookerType: 'company' as const,
  repeatBookerCount: 0,
  broughtLeads: false,
  avNeeds: true,
  cateringNeeds: true,
};

test('the written tariff gives a company the full price inside the London band', () => {
  const priced = priceFromTariff(companyDay);
  assert.equal(priced.freeCommunitySlot, false);
  assert.equal(priced.priceBeforeNoiseGbp, 1890);
  assert.equal(priced.pricePaidGbp, 1890);
  assert.ok(priced.pricePaidGbp >= MARKET_EVENING_LOW_GBP);
  assert.ok(priced.pricePaidGbp <= MARKET_EVENING_HIGH_GBP);
  const agency = priceFromTariff({ ...companyDay, bookerType: 'agency' });
  assert.ok(agency.pricePaidGbp < priced.pricePaidGbp);
});

test('a company 4-hour evening for 80 people sits near the published median', () => {
  const priced = priceFromTariff({
    isEvening: true,
    isWeekend: false,
    hours: 4,
    headcount: 80,
    bookerType: 'company',
    repeatBookerCount: 0,
    broughtLeads: false,
    avNeeds: true,
    cateringNeeds: false,
  });
  assert.equal(priced.priceBeforeNoiseGbp, 1370);
  assert.equal(priced.pricePaidGbp, 1370);
  assert.ok(priced.pricePaidGbp >= 840 && priced.pricePaidGbp <= 2075);
});

test('every SAMPLE company price stays inside the published London band', () => {
  const companies = generateSampleBookings().filter((row) => row.bookerType === 'company');
  assert.equal(companies.length, 30);
  for (const row of companies) {
    assert.ok(
      row.pricePaidGbp >= MARKET_EVENING_LOW_GBP && row.pricePaidGbp <= MARKET_EVENING_HIGH_GBP,
      `${row.bookingId} is £${row.pricePaidGbp}`,
    );
  }
});

test('a short community evening with leads is a free slot', () => {
  const priced = priceFromTariff({
    isEvening: true,
    isWeekend: false,
    hours: 4,
    headcount: 80,
    bookerType: 'community',
    repeatBookerCount: 6,
    broughtLeads: true,
    avNeeds: true,
    cateringNeeds: false,
  });
  assert.equal(priced.freeCommunitySlot, true);
  assert.equal(priced.pricePaidGbp, 0);
});

test('a house community with leads is free even for a long day', () => {
  const priced = priceFromTariff({
    isEvening: false,
    isWeekend: true,
    hours: 10,
    headcount: 90,
    bookerType: 'community',
    repeatBookerCount: 8,
    broughtLeads: true,
    avNeeds: true,
    cateringNeeds: false,
  });
  assert.equal(priced.pricePaidGbp, 0);
  assert.equal(priced.freeCommunitySlot, true);
});

test('a long community day with few past bookings is paid', () => {
  const priced = priceFromTariff({
    isEvening: false,
    isWeekend: true,
    hours: 10,
    headcount: 90,
    bookerType: 'community',
    repeatBookerCount: 2,
    broughtLeads: true,
    avNeeds: true,
    cateringNeeds: false,
  });
  assert.equal(priced.freeCommunitySlot, false);
  assert.ok(Math.abs(priced.priceBeforeNoiseGbp - 191.6055) < 0.05);
  assert.equal(priced.pricePaidGbp, 190);
});

test('a tiny community meetup with no leads snaps to free', () => {
  const priced = priceFromTariff({
    isEvening: true,
    isWeekend: false,
    hours: 2.5,
    headcount: 25,
    bookerType: 'community',
    repeatBookerCount: 0,
    broughtLeads: false,
    avNeeds: false,
    cateringNeeds: false,
  });
  assert.equal(priced.pricePaidGbp, 0);
  assert.equal(priced.freeCommunitySlot, true);
});

test('a startup launch sits between a community price and a company price', () => {
  const priced = priceFromTariff({
    isEvening: true,
    isWeekend: false,
    hours: 4,
    headcount: 100,
    bookerType: 'startup',
    repeatBookerCount: 0,
    broughtLeads: true,
    avNeeds: true,
    cateringNeeds: true,
  });
  assert.equal(priced.freeCommunitySlot, false);
  assert.ok(Math.abs(priced.priceBeforeNoiseGbp - 1516.5) < 0.02);
  assert.equal(priced.pricePaidGbp, 1515);
});

test('noise and a manual change stay deterministic', () => {
  const priced = priceFromTariff(companyDay, () => 0);
  assert.equal(priced.pricePaidGbp, 1595);
  const free = priceFromTariff(
    {
      isEvening: true,
      isWeekend: false,
      hours: 4,
      headcount: 80,
      bookerType: 'community',
      repeatBookerCount: 6,
      broughtLeads: true,
      avNeeds: true,
      cateringNeeds: false,
    },
    () => 0,
  );
  assert.equal(free.pricePaidGbp, 0);
});
