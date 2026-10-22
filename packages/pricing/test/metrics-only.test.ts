import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formatGbp, roundTo5 } from '../src/money.ts';

test('money helpers round and format GBP', () => {
  assert.equal(roundTo5(158.4), 160);
  assert.equal(roundTo5(3960), 3960);
  assert.equal(roundTo5(0), 0);
  assert.equal(formatGbp(0), '£0');
  assert.equal(formatGbp(3960), '£3,960');
  assert.equal(formatGbp(1515), '£1,515');
});
