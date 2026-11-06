import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultFarePolicy, farePolicySchema, fareSupplements, routeZone, priceFare } from '../lib/fare-policy.ts';

test('tariff zones require the whole route to remain within an active circle and allow multiple cities', () => {
  assert.equal(routeZone(defaultFarePolicy, [[103.85, 13.36], [103.86, 13.37]]).id, 'siem-reap');
  assert.equal(routeZone(defaultFarePolicy, []), null);
  assert.equal(routeZone(defaultFarePolicy, [[103.85, 13.36], [104.5, 13.36], [103.86, 13.37]]), null);
  assert.equal(routeZone({ ...defaultFarePolicy, zones: [{ ...defaultFarePolicy.zones[0], active: false }] }, [[103.85, 13.36]]), null);
  const policy = { ...defaultFarePolicy, zones: [...defaultFarePolicy.zones, { id: 'phnom-penh', name: 'Phnom Penh', latitude: 11.56, longitude: 104.92, radiusKm: 20, active: true }] };
  assert.equal(routeZone(policy, [[104.92, 11.56], [104.93, 11.57]]).id, 'phnom-penh');
  assert.equal(farePolicySchema.safeParse({ ...policy, zones: [policy.zones[0], policy.zones[0]] }).success, false);
});

test('city pickup, minimum and supplements use Cambodia hours, and KHR remains opt-in', () => {
  const policy = { ...defaultFarePolicy, cityPickupCents: 100, cityMinimumCents: 500, vehicleSurcharges: { SEDAN: 50 }, timeSurcharges: [{ label: 'Night', startHour: 22, endHour: 6, cents: 100 }], exceptionalSurcharges: [{ label: 'Holiday', cents: 25 }] };
  assert.equal(farePolicySchema.parse(defaultFarePolicy).khrPerUsd, null);
  assert.equal(farePolicySchema.safeParse({ ...policy, khrPerUsd: 0 }).success, false);
  assert.equal(farePolicySchema.safeParse({ ...policy, vehicleSurcharges: { UNKNOWN: 100 } }).success, false);
  assert.deepEqual(fareSupplements(policy, 'SEDAN', new Date('2026-11-06T16:00:00Z')).map((fee) => fee.cents), [25, 50, 100]);
  assert.deepEqual(fareSupplements(policy, 'SUV', new Date('2026-11-06T05:00:00Z')).map((fee) => fee.cents), [25]);
  assert.equal(farePolicySchema.safeParse({ ...policy, timeSurcharges: [{ label: 'Invalid', startHour: 6, endHour: 6, cents: 100 }] }).success, false);
  const fare = { policy, mode: 'CITY', distanceMeters: 1000, supplements: fareSupplements(policy, 'SEDAN', new Date('2026-11-06T16:00:00Z')) };
  assert.equal(priceFare(fare), 500);
  assert.equal(priceFare({ ...fare, distanceMeters: 10000 }), 925);
  assert.equal(priceFare({ ...fare, distanceMeters: 10000, adjustmentCents: 100 }), 1025);
  assert.equal(priceFare({ ...fare, mode: 'AIRPORT', adjustmentCents: 500 }), 3000);
  assert.equal(priceFare({ ...fare, mode: 'AIRPORT', adjustmentCents: -200 }), 2800);
  assert.throws(() => priceFare({ ...fare, mode: 'OUTSIDE' }), /Agreed/);
  assert.equal(priceFare({ ...fare, mode: 'OUTSIDE', negotiatedPriceCents: 4200 }), 4200);
});
