import { test } from 'node:test';
import { randomBytes, createECDH } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assert, request, setup, createAccount } from './helpers.mjs';

function subscription(prefix, language = 'fr', mode = 'normal') {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return { endpoint: `https://fcm.googleapis.com/${prefix}/${mode}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }, language };
}
async function waitFor(check) {
  for (let i = 0; i < 80; i++) {
    const value = await check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('Notification did not reach the expected persistent state');
}

test('device subscriptions, localized delivery, isolation, retries, expiry and logout are persisted', async () => {
  const ctx = await setup();
  try {
    assert.ok(process.env.PUSH_VALIDATION_LOG, 'Start the isolated server with push-transport-fixture.mjs; never send test pushes to real services');
    const customer = await createAccount(ctx, 'CUSTOMER');
    const other = await createAccount(ctx, 'CUSTOMER', 'other');
    const selected = subscription(ctx.prefix);
    assert.equal((await request('/api/notifications/subscriptions', 'POST', selected)).status, 401);
    assert.equal((await request('/api/notifications/subscriptions', 'POST', { ...selected, endpoint: 'https://127.0.0.1/private' }, customer.cookie)).status, 400);
    assert.equal((await request('/api/notifications/subscriptions', 'POST', { ...selected, keys: { ...selected.keys, auth: 'bad' } }, customer.cookie)).status, 400);
    const saved = await request('/api/notifications/subscriptions', 'POST', selected, customer.cookie);
    assert.equal(saved.status, 201);
    assert.equal((await request('/api/notifications/subscriptions', 'POST', selected, other.cookie)).status, 409);
    const id = saved.data.subscription.id;
    assert.equal((await ctx.prisma.pushSubscription.findUniqueOrThrow({ where: { id } })).userId, customer.id);
    assert.equal((await request(`/api/notifications/device?id=${id}`, 'GET', undefined, other.cookie)).status, 403);
    assert.equal((await request(`/api/notifications/device?id=${id}`, 'GET', undefined, customer.cookie)).status, 200);
    assert.equal((await request(`/api/notifications/subscriptions?endpoint=${encodeURIComponent(selected.endpoint)}`, 'GET', undefined, other.cookie)).data.subscription, null);
    assert.equal((await request('/api/notifications/test', 'POST', { endpoint: selected.endpoint }, other.cookie)).status, 404);
    assert.equal((await request('/api/notifications/test', 'POST', { endpoint: selected.endpoint }, customer.cookie)).status, 202);
    const sent = await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { subscriptionId: id, sentAt: { not: null } } }));
    assert.equal(sent.attempts, 1);
    assert.equal((await request('/api/notifications/test', 'POST', { endpoint: selected.endpoint }, customer.cookie)).status, 429);
    const attempts = readFileSync(process.env.PUSH_VALIDATION_LOG, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const transport = attempts.find(event => event.endpoint === selected.endpoint);
    assert.equal(transport.payload.lang, 'fr');
    assert.match(transport.payload.body, /fonctionnent/);
    assert.equal(transport.payload.data.url, '/account');
    assert.ok(!JSON.stringify(transport.payload).includes(customer.email));

    const retry = subscription(`${ctx.prefix}-retry`, 'km', 'retry');
    const retried = await request('/api/notifications/subscriptions', 'POST', retry, customer.cookie);
    assert.equal(retried.status, 201);
    assert.equal((await request('/api/notifications/test', 'POST', { endpoint: retry.endpoint }, customer.cookie)).status, 202);
    const failed = await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { subscriptionId: retried.data.subscription.id, lastError: 'PUSH_503' } }));
    assert.equal(failed.sentAt, null);
    await ctx.prisma.pushDelivery.update({ where: { id: failed.id }, data: { availableAt: new Date(0) } });
    const cron = () => fetch(`${process.env.VALIDATION_URL}/api/cron/push-notifications`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    assert.equal((await request('/api/cron/push-notifications')).status, 401);
    await Promise.all([cron(), cron()]);
    const delivered = await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: failed.id } });
    assert.ok(delivered.sentAt);
    assert.equal(delivered.attempts, 2, 'Concurrent cron claims send one retry');
    const gone = subscription(`${ctx.prefix}-gone`, 'en', 'gone');
    assert.equal((await request('/api/notifications/subscriptions', 'POST', gone, customer.cookie)).status, 201);
    assert.equal((await request('/api/notifications/test', 'POST', { endpoint: gone.endpoint }, customer.cookie)).status, 202);
    await waitFor(async () => !await ctx.prisma.pushSubscription.count({ where: { endpoint: gone.endpoint } }));

    assert.equal((await request('/api/notifications/subscriptions', 'DELETE', { endpoint: selected.endpoint }, other.cookie)).status, 200);
    assert.ok(await ctx.prisma.pushSubscription.count({ where: { id } }));
    assert.equal((await request('/api/auth/logout', 'POST', { pushEndpoint: selected.endpoint }, customer.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushSubscription.count({ where: { id } }), 0);
    assert.equal((await request(`/api/notifications/device?id=${id}`, 'GET', undefined, customer.cookie)).status, 403);
  } finally { await ctx.cleanup(); }
});

test('booking assignment, passenger arrival and driver lifecycle notify only the respective accounts', async () => {
  const ctx = await setup();
  try {
    assert.ok(process.env.PUSH_VALIDATION_LOG);
    const customer = await createAccount(ctx, 'CUSTOMER');
    const other = await createAccount(ctx, 'CUSTOMER', 'other');
    const driver = await createAccount(ctx, 'DRIVER');
    const otherDriver = await createAccount(ctx, 'DRIVER', 'other-driver');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    for (const [account, label] of [[ctx, 'admin'], [customer, 'customer'], [other, 'other'], [driver, 'driver'], [otherDriver, 'other-driver']]) {
      assert.equal((await request('/api/notifications/subscriptions', 'POST', subscription(`${ctx.prefix}-${label}`), account.cookie)).status, 201);
    }
    const created = await request('/api/admin/bookings', 'POST', {
      customerId: customer.id, driverId, fromAddress: 'SAI Airport', toAddress: 'Validation hotel',
      direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER', pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 1, priceCents: 3000,
    }, ctx.cookie);
    assert.equal(created.status, 201);
    const id = created.data.booking.id;
    await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { bookingId: id, kind: 'ASSIGNED', sentAt: { not: null } } }));
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, driverId }, ctx.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { bookingId: id, kind: 'ASSIGNED' } }), 1);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status: 'DRIVER_ACCEPTED' }, otherDriver.cookie)).status, 404);
    for (const status of ['DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED']) {
      assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status }, driver.cookie)).status, 200);
      if (status !== 'DRIVER_ACCEPTED') await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { bookingId: id, kind: { DRIVER_EN_ROUTE: 'EN_ROUTE', DRIVER_ARRIVED: 'ARRIVED', TRIP_STARTED: 'STARTED', TRIP_COMPLETED: 'COMPLETED' }[status], sentAt: { not: null } } }));
    }
    const deliveries = await ctx.prisma.pushDelivery.findMany({ where: { bookingId: id }, include: { subscription: true } });
    const accounts = [ctx.id, customer.id, other.id, driver.id, otherDriver.id];
    assert.deepEqual(deliveries.filter(event => accounts.includes(event.subscription.userId)).map(event => [event.kind, event.subscription.userId]).sort(), [
      ['ASSIGNED', driver.id], ['ARRIVED', customer.id], ['EN_ROUTE', ctx.id], ['STARTED', ctx.id], ['COMPLETED', ctx.id],
    ].sort());
    assert.ok(deliveries.filter(event => !accounts.includes(event.subscription.userId)).every(event => event.recipientRole === 'ADMIN'));
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: id } }), 0, 'Completion notification does not mean payment');
  } finally { await ctx.cleanup(); }
});

test('both GPS transmission APIs notify administrators for measured movement, but not stationary or repeated points', async () => {
  const ctx = await setup();
  try {
    assert.ok(process.env.PUSH_VALIDATION_LOG);
    const driver = await createAccount(ctx, 'DRIVER');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    assert.equal((await request('/api/notifications/subscriptions', 'POST', subscription(ctx.prefix), ctx.cookie)).status, 201);
    const earlier = { driverId, latitude: 13.36, longitude: 103.85, accuracy: 5, recordedAt: new Date(Date.now() - 65_000) };
    await ctx.prisma.driverLocation.create({ data: earlier });
    assert.equal((await request('/api/driver/location', 'PUT', { latitude: 13.36, longitude: 103.85, accuracy: 5 }, driver.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { driverId, kind: 'MOVING' } }), 0);
    await ctx.prisma.driverLocation.deleteMany({ where: { driverId } });
    await ctx.prisma.driverLocation.create({ data: earlier });
    assert.equal((await request('/api/driver/location', 'PUT', { latitude: 13.361, longitude: 103.85, accuracy: 5 }, driver.cookie)).status, 200);
    await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { driverId, kind: 'MOVING', sentAt: { not: null } } }));
    await ctx.prisma.driverLocation.deleteMany({ where: { driverId } });
    await ctx.prisma.driverLocation.create({ data: earlier });
    assert.equal((await request('/api/driver/location', 'PUT', { latitude: 13.362, longitude: 103.85, accuracy: 5 }, driver.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { driverId, kind: 'MOVING', subscription: { userId: ctx.id } } }), 1);
    await ctx.prisma.driverProfile.update({ where: { id: driverId }, data: { lastMovementPushAt: new Date(Date.now() - 65_000) } });
    const booking = await ctx.prisma.booking.create({ data: {
      reference: ctx.prefix, driverId, status: 'DRIVER_EN_ROUTE', fromAddress: 'GPS: 13.36, 103.85', toAddress: 'Hotel',
      direction: 'AIRPORT_TO_CITY', tripType: 'CITY_TRANSFER', pickupAt: new Date(), passengers: 1, priceCents: 375,
    } });
    await ctx.prisma.driverLocation.deleteMany({ where: { driverId } });
    await ctx.prisma.driverLocation.create({ data: { ...earlier, bookingId: booking.id } });
    assert.equal((await request(`/api/driver/bookings/${booking.id}/location`, 'PUT', { latitude: 13.363, longitude: 103.85, accuracy: 5 }, driver.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { driverId, kind: 'MOVING', recipientRole: 'ADMIN', subscription: { userId: ctx.id } } }), 2);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { driverId, kind: 'MOVING', recipientRole: { not: 'ADMIN' } } }), 0);
  } finally { await ctx.cleanup(); }
});

test('stale booking ownership, suspended recipients and expired alerts never reach push transport', async () => {
  const ctx = await setup();
  try {
    assert.ok(process.env.PUSH_VALIDATION_LOG);
    const customer = await createAccount(ctx, 'CUSTOMER');
    const other = await createAccount(ctx, 'CUSTOMER', 'other');
    const driver = await createAccount(ctx, 'DRIVER');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    const selected = subscription(ctx.prefix);
    const saved = await request('/api/notifications/subscriptions', 'POST', selected, customer.cookie);
    assert.equal(saved.status, 201);
    const subscriptionId = saved.data.subscription.id;
    const booking = await ctx.prisma.booking.create({ data: {
      reference: ctx.prefix, customerId: other.id, driverId, status: 'DRIVER_ARRIVED',
      fromAddress: 'Origin', toAddress: 'Destination', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER',
      passengers: 1, priceCents: 3000, pickupAt: new Date(),
    } });
    const base = { subscriptionId, recipientRole: 'CUSTOMER', expiresAt: new Date(Date.now() + 60_000) };
    const stale = await ctx.prisma.pushDelivery.create({ data: { ...base, eventKey: `${ctx.prefix}:stale`, kind: 'ARRIVED', bookingId: booking.id, driverId } });
    const expired = await ctx.prisma.pushDelivery.create({ data: { ...base, eventKey: `${ctx.prefix}:expired`, kind: 'TEST', expiresAt: new Date(Date.now() - 1000) } });
    const cron = () => fetch(`${process.env.VALIDATION_URL}/api/cron/push-notifications`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    assert.equal((await cron()).status, 200);
    assert.equal((await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: stale.id } })).lastError, 'STALE_OR_UNAUTHORIZED');
    assert.equal((await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: expired.id } })).sentAt, null);
    const suspended = await ctx.prisma.pushDelivery.create({ data: { ...base, eventKey: `${ctx.prefix}:suspended`, kind: 'TEST' } });
    await ctx.prisma.user.update({ where: { id: customer.id }, data: { status: 'SUSPENDED' } });
    await cron();
    assert.equal((await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: suspended.id } })).lastError, 'STALE_OR_UNAUTHORIZED');
    const sent = readFileSync(process.env.PUSH_VALIDATION_LOG, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    assert.equal(sent.filter(item => item.endpoint === selected.endpoint).length, 0);
    await ctx.prisma.user.update({ where: { id: customer.id }, data: { status: 'ACTIVE' } });
    for (let i = 0; i < 19; i++) {
      const selected = subscription(`${ctx.prefix}-limit-${i}`);
      await ctx.prisma.pushSubscription.create({ data: { userId: customer.id, endpoint: selected.endpoint, ...selected.keys } });
    }
    assert.equal((await request('/api/notifications/subscriptions', 'POST', subscription(`${ctx.prefix}-overflow`), customer.cookie)).status, 409);
    assert.equal(await ctx.prisma.pushSubscription.count({ where: { userId: customer.id } }), 20);
  } finally { await ctx.cleanup(); }
});
