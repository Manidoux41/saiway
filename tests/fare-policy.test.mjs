import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultFarePolicy, farePolicy, farePolicySchema, priceFare, extraTourHours, measuredDistance } from '../lib/fare-policy.ts';

const base = { policy: defaultFarePolicy, distanceMeters: null, distanceSource: 'PACKAGE', circuit: null, bookedHours: 8, extraHours: 0, startedAt: null, finalized: false };
test('airport fares are 30 dollars; new city fares have a 3.75 dollar minimum and legacy snapshots retain their minimum', () => {
  assert.equal(priceFare({ ...base, mode: 'AIRPORT' }), 3000);
  assert.equal(priceFare({ ...base, mode: 'CITY', distanceMeters: 5000 }), 375);
  assert.equal(priceFare({ ...base, mode: 'CITY', distanceMeters: 100 }), 375);
  assert.equal(priceFare({ ...base, mode: 'CITY', distanceMeters: 0 }), 375);
  assert.equal(priceFare({ ...base, mode: 'CITY', distanceMeters: 5769 }), 375);
  assert.equal(priceFare({ ...base, mode: 'CITY', distanceMeters: 5777 }), 376);
  assert.equal(priceFare({ ...base, mode: 'CITY', distanceMeters: 10000 }), 650);
  assert.equal(priceFare({ ...base, mode: 'CITY', distanceMeters: 100, policy: { ...defaultFarePolicy, cityMinimumCents: 0 } }), 7);
  assert.throws(() => priceFare({ ...base, mode: 'CITY' }), /Distance required/);
  assert.equal(farePolicySchema.safeParse({ ...defaultFarePolicy, airportCents: 3001 }).success, false);
  assert.equal(farePolicySchema.safeParse({ ...defaultFarePolicy, grandCircuitCents: 3400 }).success, false);
});
test('tour packages include waiting and driver meal, with 5 dollars per started extra hour', () => {
  assert.equal(priceFare({ ...base, mode: 'TOUR', circuit: 'SMALL' }), 3500);
  assert.equal(priceFare({ ...base, mode: 'TOUR', circuit: 'GRAND' }), 4500);
  assert.equal(extraTourHours(8, 8 * 3600000, 8), 0);
  assert.equal(extraTourHours(8, 8 * 3600000 + 1, 8), 1);
  assert.equal(extraTourHours(9.5, 0, 8), 2);
  assert.equal(priceFare({ ...base, mode: 'TOUR', circuit: 'SMALL', extraHours: 2 }), 4500);
  assert.throws(() => priceFare({ ...base, mode: 'TOUR', circuit: 'REMOTE' }), /configured/);
  assert.equal(priceFare({ ...base, mode: 'TOUR', circuit: 'REMOTE', policy: { ...defaultFarePolicy, remoteCircuitCents: 5500 } }), 5500);
  assert.deepEqual(farePolicy(null), defaultFarePolicy);
  assert.throws(() => farePolicy('{"cityCentsPerKm":0}'));
});
test('meter sums actual GPS segments and rejects gaps, stale tails, poor accuracy and implausible jumps', () => {
  const start = new Date('2026-11-06T00:00:00Z');
  const end = new Date(start.getTime() + 30000);
  const point = (seconds, longitude, accuracy = 5) => ({ latitude: 13.36, longitude, accuracy, recordedAt: new Date(start.getTime() + seconds * 1000) });
  const points = [point(0, 103.85), point(15, 103.851), point(30, 103.852)];
  const result = measuredDistance(points, start, end);
  assert.equal(result.complete, true);
  assert.ok(result.meters > 200 && result.meters < 230);
  assert.equal(measuredDistance([point(0, 103.85), point(90, 103.851)], start, new Date(start.getTime() + 90000)).complete, false);
  assert.equal(measuredDistance([point(0, 103.85), point(15, 103.851, 100)], start, end).complete, false);
  assert.equal(measuredDistance([point(0, 103.85), point(15, 104.5)], start, end).complete, false);
  assert.equal(measuredDistance(points, start, new Date(start.getTime() + 120000)).complete, false);
  assert.equal(measuredDistance([], start, end).complete, false);
  const stationary = [point(0, 103.85, 10), point(15, 103.85008, 10), point(30, 103.84992, 10)];
  assert.equal(measuredDistance(stationary, start, end).meters, 0);
  const slow = [0, 15, 30, 45].map((seconds, index) => point(seconds, 103.85 + index * 0.00004, 5));
  assert.ok(measuredDistance(slow, start, new Date(start.getTime() + 45000)).meters > 10);
});
