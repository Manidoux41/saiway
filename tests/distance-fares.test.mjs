import { test } from 'node:test';
import { assert, request, setup, createAccount, base } from './helpers.mjs';
import { defaultFarePolicy, farePolicyKey } from '../lib/fare-policy.ts';

const trip = { fromAddress: 'GPS: 13.36, 103.85', toAddress: 'GPS: 13.37, 103.86', direction: 'AIRPORT_TO_CITY', tripType: 'CITY_TRANSFER', pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 1 };

test('server-calculated city and tour quotes persist, policy changes preserve snapshots and roles cannot forge fares', async () => {
  const ctx = await setup();
  const original = await ctx.prisma.systemSetting.findUnique({ where: { key: farePolicyKey } });
  try {
    assert.equal((await fetch(`${base}/admin`, { headers: { Cookie: ctx.cookie } })).status, 200);
    const customer = await createAccount(ctx, 'CUSTOMER');
    const quotePath = '/api/bookings/quote?' + new URLSearchParams({ fromAddress: trip.fromAddress, toAddress: trip.toAddress, direction: trip.direction, tripType: trip.tripType });
    assert.equal((await request(quotePath)).status, 403);
    const quote = await request(quotePath, 'GET', undefined, customer.cookie);
    assert.equal(quote.status, 200);
    assert.equal(quote.data.priceCents, 325);
    const created = await request('/api/bookings', 'POST', trip, customer.cookie);
    assert.equal(created.status, 201);
    assert.equal(created.data.booking.priceCents, 325);
    assert.equal(created.data.booking.fareDetails.distanceMeters, 5000);
    for (const forged of [{ priceCents: 1 }, { distanceMeters: 1 }, { fareDetails: { policy: { cityCentsPerKm: 1 } } }]) {
      assert.equal((await request('/api/bookings', 'POST', { ...trip, ...forged }, customer.cookie)).status, 400);
    }
    const policy = { entity: 'setting', data: { key: farePolicyKey, value: { ...defaultFarePolicy, cityCentsPerKm: 100 } } };
    assert.equal((await request('/api/admin/management', 'POST', policy, customer.cookie)).status, 403);
    assert.equal((await request('/api/admin/management', 'POST', policy, ctx.cookie)).status, 201);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: created.data.booking.id } })).priceCents, 325);
    assert.equal((await request(quotePath, 'GET', undefined, customer.cookie)).data.priceCents, 500);
    const tour = await request('/api/bookings', 'POST', { ...trip, tripType: 'TOURIST_TOUR', tourCircuit: 'GRAND', tourHours: 9.5, paymentMethod: 'DRIVER' }, customer.cookie);
    assert.equal(tour.status, 201);
    assert.equal(tour.data.booking.priceCents, 5500);
    assert.equal(tour.data.booking.fareDetails.extraHours, 2);
    assert.equal((await request('/api/bookings/payment-method', 'POST', { bookingId: tour.data.booking.id, paymentMethod: 'ONLINE' }, customer.cookie)).status, 409);
    for (const direction of ['AIRPORT_TO_CITY', 'CITY_TO_AIRPORT']) {
      const airport = await request('/api/bookings', 'POST', { ...trip, tripType: 'AIRPORT_TRANSFER', direction }, customer.cookie);
      assert.equal(airport.status, 201);
      assert.equal(airport.data.booking.priceCents, 3000);
    }
    assert.equal((await request('/api/admin/management', 'POST', { ...policy, data: { ...policy.data, value: { ...defaultFarePolicy, airportCents: 3100 } } }, ctx.cookie)).status, 400);
  } finally {
    try {
      if (original) await ctx.prisma.systemSetting.upsert({ where: { key: farePolicyKey }, create: original, update: { value: original.value } });
      else await ctx.prisma.systemSetting.deleteMany({ where: { key: farePolicyKey } });
    } finally { await ctx.cleanup(); }
  }
});

test('driver walk-up trips use their own GPS, reject overlap and finalize with explicit road fallback when GPS is incomplete', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const driver = await createAccount(ctx, 'DRIVER');
    const other = await createAccount(ctx, 'DRIVER', 'other');
    const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } });
    const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } });
    await ctx.prisma.driverLocation.create({ data: { driverId: profile.id, latitude: 13.36, longitude: 103.85, accuracy: 5 } });
    const { pickupAt, ...details } = trip; void pickupAt;
    const body = { ...details, customerEmail: customer.email, vehicleId: vehicle.id };
    assert.equal((await request('/api/driver/bookings', 'POST', body, customer.cookie)).status, 403);
    const started = await request('/api/driver/bookings', 'POST', body, driver.cookie);
    assert.equal(started.status, 201);
    assert.equal(started.data.booking.status, 'TRIP_STARTED');
    assert.equal(started.data.booking.metered, true);
    const id = started.data.booking.id;
    await ctx.prisma.booking.create({ data: { ...trip, priceCents: 325, pickupAt: new Date(Date.now() - 86400000), reference: ctx.prefix, customerId: customer.id, driverId: profile.id, vehicleId: vehicle.id, status: 'DRIVER_ASSIGNED' } });
    assert.equal((await request('/api/driver/location', 'GET', undefined, driver.cookie)).data.booking.id, id);
    await ctx.prisma.driverLocation.updateMany({ where: { driverId: profile.id }, data: { recordedAt: new Date(Date.now() - 3000) } });
    const shared = await request('/api/driver/location', 'PUT', { latitude: 13.36, longitude: 103.85, accuracy: 5 }, driver.cookie);
    assert.equal(shared.status, 200);
    assert.equal(shared.data.bookingId, id);
    assert.ok(await ctx.prisma.driverLocation.findFirst({ where: { bookingId: id, recordedAt: new Date(shared.data.recordedAt) } }));
    assert.equal((await request('/api/driver/bookings', 'POST', body, driver.cookie)).status, 409);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status: 'TRIP_COMPLETED' }, other.cookie)).status, 404);
    const incomplete = await request('/api/driver/bookings', 'PATCH', { id, status: 'TRIP_COMPLETED' }, driver.cookie);
    assert.equal(incomplete.status, 409);
    assert.equal(incomplete.data.error, 'GPS_INCOMPLETE_CONFIRM_ROUTE');
    const finished = await request('/api/driver/bookings', 'PATCH', { id, status: 'TRIP_COMPLETED', confirmEstimatedDistance: true }, driver.cookie);
    assert.equal(finished.status, 200);
    assert.equal(finished.data.booking.priceCents, 325);
    assert.equal(finished.data.booking.fareDetails.distanceSource, 'CONFIRMED_ROUTE');
    const receipt = await request('/api/driver/payments', 'POST', { bookingId: id, received: true, collectionMethod: 'CASH' }, driver.cookie);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.data.booking.payments[0].amountCents, 325);
    const second = await request('/api/driver/bookings', 'POST', body, driver.cookie);
    assert.equal(second.status, 201);
    const measuredId = second.data.booking.id;
    const start = new Date(Date.now() - 30000);
    await ctx.prisma.booking.update({ where: { id: measuredId }, data: { fareDetails: { ...second.data.booking.fareDetails, startedAt: start.toISOString() } } });
    await ctx.prisma.driverLocation.deleteMany({ where: { bookingId: measuredId } });
    await ctx.prisma.driverLocation.createMany({ data: [0, 15, 30].map((seconds, index) => ({
      driverId: profile.id, bookingId: measuredId, latitude: 13.36, longitude: 103.85 + index * 0.001,
      accuracy: 5, recordedAt: new Date(start.getTime() + seconds * 1000),
    })) });
    const measured = await request('/api/driver/bookings', 'PATCH', { id: measuredId, status: 'TRIP_COMPLETED' }, driver.cookie);
    assert.equal(measured.status, 200);
    assert.equal(measured.data.booking.fareDetails.distanceSource, 'GPS');
    assert.ok(measured.data.booking.fareDetails.distanceMeters > 200 && measured.data.booking.fareDetails.distanceMeters < 230);
    assert.equal(measured.data.booking.priceCents, Math.round(measured.data.booking.fareDetails.distanceMeters * 65 / 1000));
  } finally { await ctx.cleanup(); }
});
