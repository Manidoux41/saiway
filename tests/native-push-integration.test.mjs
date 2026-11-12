import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { assert, request, setup, createAccount } from './helpers.mjs';

async function waitFor(check) {
  for (let attempt = 0; attempt < 80; attempt++) {
    const result = await check();
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('Expected durable native delivery state was not reached');
}
test('native devices reuse booking events and persist tickets, retries, revocation and logout', async () => {
  const database = new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname) && database.pathname.includes('validation') && process.env.PUSH_VALIDATION_LOG, 'Only use an isolated local database and mocked push transport');
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const other = await createAccount(ctx, 'CUSTOMER', 'other');
    const driver = await createAccount(ctx, 'DRIVER');
    const customerToken = `ExpoPushToken[${ctx.prefix}_customer]`;
    const driverToken = `ExpoPushToken[${ctx.prefix}_driver]`;
    const native = (token, language = 'fr') => ({ token, platform: 'android', language });
    assert.equal((await request('/api/notifications/native', 'POST', native(customerToken))).status, 401);
    for (const [account, token, language] of [[customer, customerToken, 'fr'], [driver, driverToken, 'km']]) {
      assert.equal((await request('/api/notifications/native', 'POST', native(token, language), account.cookie)).status, 201);
    }
    assert.equal((await request('/api/notifications/native', 'POST', native(customerToken), other.cookie)).status, 409);
    assert.equal((await request(`/api/notifications/native?token=${encodeURIComponent(customerToken)}`, 'GET', undefined, other.cookie)).data.enabled, false);
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    const created = await request('/api/admin/bookings', 'POST', {
      customerId: customer.id, driverId, fromAddress: 'SAI Airport', toAddress: 'Validation hotel',
      direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER',
      pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 1, priceCents: 3000,
    }, ctx.cookie);
    assert.equal(created.status, 201);
    const bookingId = created.data.booking.id;
    const assignment = await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { bookingId, kind: 'ASSIGNED', sentAt: { not: null }, pushTicketId: { not: null } } }));
    assert.equal(assignment.attempts, 1);
    await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { bookingId, kind: 'BOOKED', sentAt: { not: null } } }));
    const events = readFileSync(process.env.PUSH_VALIDATION_LOG, 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const sent = events.find(event => event.endpoint === driverToken);
    assert.equal(sent.payload.data.bookingId, bookingId);
    assert.equal(sent.payload.data.recipientId, driver.id);
    assert.match(sent.payload.body, /[\u1780-\u17ff]/u);
    assert.ok(!JSON.stringify(sent.payload).includes(customer.email));
    assert.ok(!JSON.stringify(sent.payload).includes('Validation hotel'));

    const retryToken = `ExpoPushToken[${ctx.prefix}_retry]`;
    await request('/api/notifications/native', 'POST', native(retryToken), customer.cookie);
    assert.equal((await request('/api/notifications/test', 'POST', { endpoint: retryToken }, other.cookie)).status, 404);
    assert.equal((await request('/api/notifications/test', 'POST', { endpoint: retryToken }, customer.cookie)).status, 202);
    const retryDevice = await ctx.prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: retryToken } });
    const retry = await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { subscriptionId: retryDevice.id, lastError: 'EXPO_HTTP_503' } }));
    await ctx.prisma.pushDelivery.update({ where: { id: retry.id }, data: { availableAt: new Date(0) } });
    const cron = () => fetch(`${process.env.VALIDATION_URL}/api/cron/push-notifications`, { headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` } });
    assert.equal((await cron()).status, 200);
    assert.equal((await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: retry.id } })).attempts, 2);

    const receiptToken = `ExpoPushToken[${ctx.prefix}_receiptgone]`;
    await request('/api/notifications/native', 'POST', native(receiptToken), customer.cookie);
    await request('/api/notifications/test', 'POST', { endpoint: receiptToken }, customer.cookie);
    const receiptDevice = await ctx.prisma.pushSubscription.findUniqueOrThrow({ where: { endpoint: receiptToken } });
    const receipt = await waitFor(() => ctx.prisma.pushDelivery.findFirst({ where: { subscriptionId: receiptDevice.id, sentAt: { not: null } } }));
    await ctx.prisma.pushDelivery.update({ where: { id: receipt.id }, data: { sentAt: new Date(Date.now() - 16 * 60_000) } });
    assert.equal((await cron()).status, 200);
    assert.equal(await ctx.prisma.pushSubscription.count({ where: { id: receiptDevice.id } }), 0);

    assert.equal((await request('/api/notifications/native', 'DELETE', { token: customerToken }, other.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushSubscription.count({ where: { endpoint: customerToken } }), 1);
    assert.equal((await request('/api/auth/logout', 'POST', { pushEndpoint: customerToken }, customer.cookie)).status, 200);
    assert.equal(await ctx.prisma.pushSubscription.count({ where: { endpoint: customerToken } }), 0);
  } finally { await ctx.cleanup(); }
});
