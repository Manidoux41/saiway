import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('agreed tourist package survives dispatch edits, includes waiting and meal, and bills elapsed overtime at completion', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const driver = await createAccount(ctx, 'DRIVER');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    const body = { fromAddress: 'Siem Reap hotel', toAddress: 'Angkor Wat', direction: 'AIRPORT_TO_CITY', tripType: 'TOURIST_TOUR', pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 2, tourCircuit: 'SMALL', tourHours: 8, paymentMethod: 'DRIVER' };
    assert.equal((await request('/api/bookings', 'POST', body)).status, 403);
    assert.equal((await request('/api/bookings', 'POST', { ...body, paymentMethod: 'ONLINE' }, customer.cookie)).status, 400);
    assert.equal((await request('/api/bookings', 'POST', { ...body, tourCircuit: 'REMOTE' }, customer.cookie)).status, 422);
    const created = await request('/api/bookings', 'POST', body, customer.cookie);
    assert.equal(created.status, 201);
    const id = created.data.booking.id;
    assert.equal(created.data.booking.priceCents, 3500);
    const assigned = await request('/api/admin/bookings', 'PATCH', { id, driverId, fromAddress: body.fromAddress, toAddress: body.toAddress, tripType: body.tripType, priceCents: 3500 }, ctx.cookie);
    assert.equal(assigned.status, 200);
    assert.deepEqual(assigned.data.booking.fareDetails, created.data.booking.fareDetails);
    for (const status of ['DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED']) {
      assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status }, driver.cookie)).status, 200);
    }
    const started = await ctx.prisma.booking.findUniqueOrThrow({ where: { id } });
    assert.ok(started.fareDetails.startedAt);
    await ctx.prisma.booking.update({ where: { id }, data: { fareDetails: { ...started.fareDetails, startedAt: new Date(Date.now() - (8 * 60 + 1) * 60000).toISOString() } } });
    const completed = await request('/api/driver/bookings', 'PATCH', { id, status: 'TRIP_COMPLETED', tourCircuit: 'GRAND' }, driver.cookie);
    assert.equal(completed.status, 200);
    assert.equal(completed.data.booking.priceCents, 5000);
    assert.equal(completed.data.booking.fareDetails.extraHours, 1);
    assert.equal(completed.data.booking.fareDetails.circuit, 'GRAND');
    assert.equal(completed.data.booking.fareDetails.finalized, true);
    const readback = (await request('/api/bookings', 'GET', undefined, customer.cookie)).data.bookings.find((item) => item.id === id);
    assert.equal(readback.priceCents, 5000);
    assert.deepEqual(readback.fareDetails, completed.data.booking.fareDetails);
  } finally { await ctx.cleanup(); }
});
