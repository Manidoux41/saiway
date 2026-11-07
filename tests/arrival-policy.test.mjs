import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arrivalConfirmed, arrivalRadiusMeters, arrivalAccuracyMeters, arrivalDwellMs, metersBetween } from '../lib/arrival-policy.ts';

const pickup = { latitude: 13.36, longitude: 103.85 };
const now = new Date('2026-11-07T10:00:00Z');
const fix = (ago, changes = {}) => ({ ...pickup, accuracy: 10, recordedAt: new Date(now.getTime() - ago), ...changes });
const north = meters => ({ latitude: pickup.latitude + meters / 6_371_000 * 180 / Math.PI, longitude: pickup.longitude });

test('arrival needs 50 m proximity, at most 20 m accuracy and at least 15 seconds of confirmation', () => {
  assert.equal(arrivalRadiusMeters, 50);
  assert.equal(arrivalAccuracyMeters, 20);
  assert.equal(arrivalDwellMs, 15_000);
  assert.equal(arrivalConfirmed(pickup, [], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(0)], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(14_999), fix(0)], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(15_000), fix(0, { accuracy: 20 })], now), true);
  assert.equal(arrivalConfirmed(pickup, [fix(15_000), fix(0, north(49.99))], now), true);
  assert.equal(arrivalConfirmed(pickup, [fix(15_000), fix(0, north(50.01))], now), false);
  assert.ok(Math.abs(metersBetween(pickup, north(50)) - 50) < 0.00001);
});

test('uncertain, interrupted, out-of-order or stale GPS cannot confirm arrival', () => {
  for (const accuracy of [null, 20.01, -1, NaN]) {
    assert.equal(arrivalConfirmed(pickup, [fix(16_000), fix(0, { accuracy })], now), false);
    assert.equal(arrivalConfirmed(pickup, [fix(16_000, { accuracy }), fix(0)], now), false);
  }
  assert.equal(arrivalConfirmed(pickup, [fix(20_001), fix(0)], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(30_000), fix(20_000, north(70)), fix(10_000), fix(0)], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(30_000), fix(20_000, { accuracy: null }), fix(10_000), fix(0)], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(20_000), fix(1000)], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(-1000), fix(0)], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(45_001), fix(0)], now), false);
  assert.equal(arrivalConfirmed(pickup, [fix(40_000, north(70)), fix(16_000), fix(0)], now), true);
});
