import { test } from 'node:test';
import { createECDH, randomBytes } from 'node:crypto';
import { assert, request, setup, createAccount } from './helpers.mjs';

const point = { latitude: 13.36, longitude: 103.85, accuracy: 10 };
const route = { from: { latitude: point.latitude, longitude: point.longitude }, to: { latitude: 13.37, longitude: 103.86 }, distanceMeters: 5000, durationSeconds: 600, coordinates: [[103.85, 13.36], [103.86, 13.37]] };

async function fixture(ctx) {
  assert.ok(process.env.PUSH_VALIDATION_LOG, 'Use an isolated database and the stubbed push transport');
  const customer = await createAccount(ctx, 'CUSTOMER');
  const driver = await createAccount(ctx, 'DRIVER');
  const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  assert.equal((await request('/api/notifications/subscriptions', 'POST', {
    endpoint: `https://fcm.googleapis.com/${ctx.prefix}/arrival`,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }, language: 'fr',
  }, customer.cookie)).status, 201);
  let index = 0;
  async function booking(changes = {}) {
    return ctx.prisma.booking.create({ data: {
      reference: `${ctx.prefix}-${index++}`, customerId: customer.id, driverId, status: 'DRIVER_EN_ROUTE',
      fromAddress: 'GPS: 13.36, 103.85', toAddress: 'Hotel', direction: 'AIRPORT_TO_CITY', tripType: 'CITY_TRANSFER',
      passengers: 1, priceCents: 500, estimatedPriceCents: 500, pickupAt: new Date(),
      updatedAt: new Date(Date.now() - 60_000), ...changes,
    } });
  }
  const seed = (bookingId, ago = 16_000, changes = {}) => ctx.prisma.driverLocation.create({ data: {
    driverId, bookingId, ...point, recordedAt: new Date(Date.now() - ago), ...changes,
  } });
  const share = (id, body = point, cookie = driver.cookie) => request(`/api/driver/bookings/${id}/location`, 'PUT', body, cookie);
  return { customer, driver, driverId, booking, seed, share };
}

async function assertArrival(ctx, id) {
  const booking = await ctx.prisma.booking.findUniqueOrThrow({ where: { id }, include: { statusHistory: true, payments: true } });
  assert.equal(booking.status, 'DRIVER_ARRIVED');
  assert.equal(booking.statusHistory.filter(item => item.status === 'DRIVER_ARRIVED').length, 1);
  assert.equal(booking.priceCents, 500);
  assert.equal(booking.startedAt, null);
  assert.equal(booking.payments.length, 0);
  assert.equal(await ctx.prisma.auditLog.count({ where: { entityId: id, action: 'AUTO_ARRIVAL' } }), 1);
  for (let attempt = 0; attempt < 80; attempt++) {
    const sent = await ctx.prisma.pushDelivery.findMany({ where: { bookingId: id, kind: 'ARRIVED' }, include: { subscription: true } });
    if (sent[0]?.sentAt) {
      assert.equal(sent.length, 1);
      assert.equal(sent[0].subscription.userId, booking.customerId);
      return;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('Arrival push was not dispatched by the GPS request without invoking Cron');
}

test('both GPS endpoints atomically confirm arrival, notify the customer without Cron and tolerate repeat/concurrent fixes', async () => {
  const ctx = await setup();
  try {
    const f = await fixture(ctx);
    const booking = await f.booking();
    assert.equal((await request(`/api/driver/bookings/${booking.id}/location`, 'PUT', point)).status, 403);
    assert.equal((await f.share(booking.id)).status, 200);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, 'DRIVER_EN_ROUTE', 'one fix is insufficient');
    await ctx.prisma.driverLocation.deleteMany({ where: { bookingId: booking.id } });
    await f.seed(booking.id);
    const replies = await Promise.all([f.share(booking.id), f.share(booking.id)]);
    assert.ok(replies.every(reply => [200, 202].includes(reply.status)));
    await assertArrival(ctx, booking.id);
    assert.ok([200, 202].includes((await f.share(booking.id)).status));
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { bookingId: booking.id, kind: 'ARRIVED' } }), 1);
    await ctx.prisma.booking.update({ where: { id: booking.id }, data: { status: 'TRIP_COMPLETED' } });

    const next = await f.booking({ fromAddress: 'Known pickup', routeDetails: route });
    await f.seed(next.id);
    await ctx.prisma.driverLocation.deleteMany({ where: { driverId: f.driverId, bookingId: booking.id } });
    const response = await request('/api/driver/location', 'PUT', point, f.driver.cookie);
    assert.equal(response.status, 200);
    await assertArrival(ctx, next.id);
    const live = await request(`/api/bookings/${next.id}/location`, 'GET', undefined, f.customer.cookie);
    assert.equal(live.status, 200);
    assert.equal(live.data.booking.status, 'DRIVER_ARRIVED');
  } finally { await ctx.cleanup(); }
});

test('arrival rejects inaccurate, interrupted, pre-departure and other-driver evidence and preserves manual fallback', async () => {
  const ctx = await setup();
  try {
    const f = await fixture(ctx);
    const other = await createAccount(ctx, 'DRIVER', 'other');
    for (const scenario of [
      { earlier: { accuracy: 21 } }, { current: { ...point, accuracy: 21 } },
      { earlier: { latitude: point.latitude + 0.001 } }, { ago: 35_000 },
      { booking: { updatedAt: new Date() } },
      { booking: { fromAddress: 'Unresolved textual address' } },
      { booking: { status: 'DRIVER_ACCEPTED' }, expected: 409 },
      { booking: { status: 'TRIP_STARTED' } },
    ]) {
      const booking = await f.booking(scenario.booking);
      await f.seed(booking.id, scenario.ago ?? 16_000, scenario.earlier);
      assert.equal((await f.share(booking.id, scenario.current ?? point, f.customer.cookie)).status, 403);
      assert.equal((await f.share(booking.id, scenario.current ?? point, other.cookie)).status, 404);
      const response = await f.share(booking.id, scenario.current ?? point);
      assert.equal(response.status, scenario.expected ?? 200);
      assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, scenario.booking?.status ?? 'DRIVER_EN_ROUTE');
      assert.equal(await ctx.prisma.pushDelivery.count({ where: { bookingId: booking.id, kind: 'ARRIVED' } }), 0);
    }
    const manual = await f.booking({ fromAddress: 'Text-only pickup' });
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id: manual.id, status: 'DRIVER_ARRIVED' }, f.driver.cookie)).status, 200);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: manual.id } })).status, 'DRIVER_ARRIVED');
    const race = await f.booking();
    await f.seed(race.id);
    const replies = await Promise.all([
      f.share(race.id),
      request('/api/driver/bookings', 'PATCH', { id: race.id, status: 'DRIVER_ARRIVED' }, f.driver.cookie),
    ]);
    assert.ok(replies.every(reply => [200, 403, 409].includes(reply.status)));
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: race.id } })).status, 'DRIVER_ARRIVED');
    assert.equal(await ctx.prisma.bookingStatusHistory.count({ where: { bookingId: race.id, status: 'DRIVER_ARRIVED' } }), 1);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { bookingId: race.id, kind: 'ARRIVED' } }), 1);
    const cached = await f.booking();
    const capturedAt = new Date(Date.now() - 16_000).toISOString();
    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await f.share(cached.id, { ...point, capturedAt })).status, attempt === 0 ? 200 : 202);
      assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: cached.id } })).status, 'DRIVER_EN_ROUTE', 'replaying one acquisition cannot satisfy dwell');
    }
    assert.equal((await f.share(cached.id, { ...point, capturedAt: new Date(Date.now() + 60_000).toISOString() })).status, 400);
    assert.equal((await f.share(cached.id, { ...point, capturedAt: new Date(Date.now() - 120_000).toISOString() })).status, 400);
    assert.equal((await f.share(cached.id, { ...point, capturedAt: new Date().toISOString() })).status, 200);
    await assertArrival(ctx, cached.id);
  } finally { await ctx.cleanup(); }
});
