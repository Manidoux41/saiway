import { test } from 'node:test';
import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assert, request, setup, createAccount } from './helpers.mjs';

async function subscribe(ctx, account, suffix) {
  const keys = createECDH('prime256v1');
  keys.generateKeys();
  const endpoint = `https://fcm.googleapis.com/${ctx.prefix}-${suffix}/normal`;
  const saved = await request('/api/notifications/subscriptions', 'POST', { endpoint, keys: { p256dh: keys.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }, language: 'fr' }, account.cookie);
  assert.equal(saved.status, 201);
  return endpoint;
}
async function waitFor(check) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('Expected queued notification was not delivered');
}

test('automatic assignment notifies customer, assigned driver and administrators exactly once; availability and service changes stay independent of payments', async () => {
  const ctx = await setup();
  try {
    assert.ok(process.env.PUSH_VALIDATION_LOG);
    const customer = await createAccount(ctx, 'CUSTOMER');
    const other = await createAccount(ctx, 'CUSTOMER', 'other');
    const driver = await createAccount(ctx, 'DRIVER');
    const otherDriver = await createAccount(ctx, 'DRIVER', 'other-driver');
    const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } });
    const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } });
    const endpoints = await Promise.all([[ctx, 'admin'], [customer, 'customer'], [other, 'other'], [driver, 'driver'], [otherDriver, 'other-driver']].map(([account, suffix]) => subscribe(ctx, account, suffix)));
    const availability = { isAvailable: true, selectedVehicleId: vehicle.id };
    assert.equal((await request('/api/driver/availability', 'PATCH', availability, customer.cookie)).status, 403);
    assert.equal((await request('/api/driver/availability', 'PATCH', availability, driver.cookie)).status, 200);
    const driverEvents = { driverId: profile.id, kind: 'AVAILABLE', subscription: { userId: ctx.id } };
    await waitFor(() => ctx.prisma.pushDelivery.count({ where: { ...driverEvents, sentAt: { not: null } } }));
    assert.equal((await request('/api/driver/availability', 'PATCH', availability, driver.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: driverEvents }), 1);
    const created = await request('/api/bookings', 'POST', {
      fromAddress: 'SAI Airport', toAddress: 'Validation hotel', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER',
      passengers: 1, pickupAt: new Date(Date.now() + 86400000).toISOString(), paymentMethod: 'DRIVER',
    }, customer.cookie);
    assert.equal(created.status, 201);
    const bookingId = created.data.booking.id;
    assert.equal(created.data.booking.driverId, profile.id);
    const expected = [['BOOKED', customer.id], ['NEW_BOOKING', ctx.id], ['ASSIGNED', driver.id], ['DISPATCHED', ctx.id]];
    await waitFor(() => ctx.prisma.pushDelivery.count({ where: { bookingId, sentAt: { not: null } } }).then(count => count >= expected.length));
    const deliveries = await ctx.prisma.pushDelivery.findMany({ where: { bookingId }, include: { subscription: true } });
    assert.deepEqual(deliveries.map(item => [item.kind, item.subscription.userId]).sort(), expected.sort());
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id: bookingId, driverId: profile.id, vehicleId: vehicle.id }, ctx.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { bookingId } }), expected.length);
    const transport = readFileSync(process.env.PUSH_VALIDATION_LOG, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.ok(transport.some(item => item.endpoint === endpoints[1] && item.payload.body.includes('prise en compte par SAIWAY')));
    assert.ok(transport.some(item => item.endpoint === endpoints[3] && item.payload.body.includes('attribuée')));
    assert.ok(!transport.some(item => [endpoints[2], endpoints[4]].includes(item.endpoint)));
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id: bookingId, status: 'DRIVER_ACCEPTED' }, otherDriver.cookie)).status, 404);
    for (const status of ['DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED']) assert.equal((await request('/api/driver/bookings', 'PATCH', { id: bookingId, status }, driver.cookie)).status, 200);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: bookingId } });
    assert.equal(stored.status, 'TRIP_COMPLETED');
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId } }), 0);
    assert.equal((await request('/api/driver/availability', 'PATCH', { ...availability, isAvailable: false }, driver.cookie)).status, 200);
    await waitFor(() => ctx.prisma.pushDelivery.count({ where: { driverId: profile.id, kind: 'UNAVAILABLE', sentAt: { not: null } } }));
    assert.equal((await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { id: profile.id } })).isAvailable, false);
  } finally { await ctx.cleanup(); }
});
