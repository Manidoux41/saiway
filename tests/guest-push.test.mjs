import test from 'node:test';
import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assert, request, setup, createAccount, base } from './helpers.mjs';
import { guestDriver, guestSession, gpsInput, cleanupGuest } from './guest-ride-helpers.mjs';

async function subscribe(ctx, account, label, count = 1) {
  const ids = [];
  for (let i = 0; i < count; i++) {
    const keys = createECDH('prime256v1');
    keys.generateKeys();
    const result = await request('/api/notifications/subscriptions', 'POST', {
      endpoint: `https://fcm.googleapis.com/${ctx.prefix}-${label}-${i}/normal`,
      keys: { p256dh: keys.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url') }, language: 'fr',
    }, account.cookie);
    assert.equal(result.status, 201);
    ids.push(result.data.subscription.id);
  }
  return ids;
}
async function waitFor(check) {
  for (let i = 0; i < 150; i++) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.fail('Expected immediate push delivery within 15 seconds');
}
const transport = () => readFileSync(process.env.PUSH_VALIDATION_LOG, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const tick = () => fetch(`${base}/api/cron/push-notifications`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
async function device(id, token) {
  const response = await fetch(`${base}/api/notifications/device?id=${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${token}` } });
  return response.status;
}

test('GPS pending requests immediately notify admin devices despite backlog, leaving manual assignment to admin without broadcasting to drivers', async () => {
  const ctx = await setup();
  const references = [];
  try {
    assert.ok(process.env.PUSH_VALIDATION_LOG);
    const driver = await guestDriver(ctx);
    await ctx.prisma.vehicle.update({ where: { id: driver.vehicle.id }, data: { active: false } });
    const unavailable = await createAccount(ctx, 'DRIVER', 'unavailable');
    await ctx.prisma.driverProfile.update({ where: { userId: unavailable.id }, data: { isAvailable: false } });
    const suspended = await createAccount(ctx, 'DRIVER', 'suspended');
    const customer = await createAccount(ctx, 'CUSTOMER');
    const adminIds = await subscribe(ctx, ctx, 'admin', 16);
    const driverIds = await subscribe(ctx, driver, 'available', 16);
    const ignored = [...await subscribe(ctx, unavailable, 'unavailable'), ...await subscribe(ctx, customer, 'customer'), ...await subscribe(ctx, suspended, 'suspended')];
    await ctx.prisma.driverProfile.update({ where: { userId: suspended.id }, data: { isAvailable: true } });
    await ctx.prisma.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    await ctx.prisma.pushDelivery.createMany({ data: Array.from({ length: 60 }, (_, i) => ({
      subscriptionId: adminIds[0], recipientRole: 'ADMIN', kind: 'TEST', eventKey: `${ctx.prefix}:backlog:${i}`,
      createdAt: new Date(Date.now() - 60000), expiresAt: new Date(Date.now() + 300000),
    })) });
    const cookie = await guestSession();
    const created = await request('/api/guest-rides', 'POST', gpsInput(), cookie);
    assert.equal(created.status, 201);
    references.push(created.data.booking.reference);
    const booking = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[0] } });
    assert.equal(booking.driverId, null);
    await waitFor(() => ctx.prisma.pushDelivery.count({ where: { bookingId: booking.id, sentAt: { not: null } } }).then(count => count === 16));
    const deliveries = await ctx.prisma.pushDelivery.findMany({ where: { bookingId: booking.id } });
    assert.equal(deliveries.length, 16);
    assert.deepEqual(deliveries.filter(d => d.kind === 'GUEST_REQUEST').map(d => d.subscriptionId).sort(), adminIds.sort());
    assert.equal(deliveries.filter(d => d.recipientRole === 'DRIVER').length, 0);
    assert.ok(deliveries.every(d => !ignored.includes(d.subscriptionId) && d.attempts === 1));
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { eventKey: { startsWith: `${ctx.prefix}:backlog:` }, sentAt: { not: null } } }), 0, 'New request is processed independently of the old queue');
    assert.equal((await request('/api/guest-rides', 'POST', gpsInput(), cookie)).data.booking.reference, booking.reference);
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { bookingId: booking.id } }), 16);
    const sent = transport().filter(item => item.payload.body.includes(booking.reference));
    assert.equal(sent.length, 16);
    assert.ok(sent.every(item => item.urgency === 'high' && item.payload.urgent && item.ttl > 0));
    assert.ok(sent.every(item => item.payload.data.url === '/admin'));
    assert.ok(sent.every(item => !JSON.stringify(item.payload).includes('13.3601234') && !JSON.stringify(item.payload).includes('103.8501234')));
    const proof = sent.find(item => item.payload.data.subscriptionId === adminIds[0]).payload.data.deviceToken;
    assert.equal(await device(adminIds[0], proof), 200, 'Service worker proof works without a login cookie');
    assert.equal(await device(adminIds[1], proof), 403);
    assert.equal(await device(adminIds[0], `${proof}x`), 403);
    await ctx.prisma.driverProfile.update({ where: { id: driver.profile.id }, data: { isAvailable: false } });
    const unavailableAlert = await ctx.prisma.pushDelivery.create({ data: {
      subscriptionId: driverIds[1], recipientRole: 'DRIVER', kind: 'PICKUP_WAITING', eventKey: `${ctx.prefix}:now-unavailable`,
      bookingId: booking.id, expiresAt: new Date(Date.now() + 60000),
    } });
    assert.equal((await tick()).status, 200);
    assert.equal((await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: unavailableAlert.id } })).lastError, 'STALE_OR_UNAUTHORIZED');
    assert.equal((await request('/api/auth/logout', 'POST', { pushEndpoint: sent.find(item => item.payload.data.subscriptionId === adminIds[0]).endpoint }, ctx.cookie)).status, 200);
    assert.equal(await device(adminIds[0], proof), 403, 'Logout revokes the proof by removing the subscription');
    assert.equal((await request('/api/guest-rides', 'DELETE', undefined, cookie)).status, 200);
    const cancelledAlert = await ctx.prisma.pushDelivery.create({ data: {
      subscriptionId: adminIds[1], recipientRole: 'ADMIN', kind: 'GUEST_REQUEST', eventKey: `${ctx.prefix}:now-cancelled`,
      bookingId: booking.id, expiresAt: new Date(Date.now() + 60000),
    } });
    assert.equal((await tick()).status, 200);
    assert.equal((await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: cancelledAlert.id } })).lastError, 'STALE_OR_UNAUTHORIZED');
  } finally { await cleanupGuest(ctx, references); }
});

test('automatically assigned GPS requests alert only administrators and the assigned driver; stale waiting alerts are discarded', async () => {
  const ctx = await setup();
  const references = [];
  try {
    const driver = await guestDriver(ctx);
    const other = await guestDriver(ctx, 'other');
    const adminIds = await subscribe(ctx, ctx, 'admin');
    const driverIds = await subscribe(ctx, driver, 'driver');
    const otherIds = await subscribe(ctx, other, 'other');
    const cookie = await guestSession();
    const created = await request('/api/guest-rides', 'POST', gpsInput(), cookie);
    assert.equal(created.status, 201);
    references.push(created.data.booking.reference);
    const booking = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[0] } });
    assert.ok(booking.driverId);
    assert.equal(booking.status, 'DRIVER_ACCEPTED');
    const assignedIds = booking.driverId === driver.profile.id ? driverIds : otherIds;
    const unassignedIds = booking.driverId === driver.profile.id ? otherIds : driverIds;
    await waitFor(() => ctx.prisma.pushDelivery.count({ where: { bookingId: booking.id, sentAt: { not: null } } }).then(count => count === 3));
    const deliveries = await ctx.prisma.pushDelivery.findMany({ where: { bookingId: booking.id } });
    assert.deepEqual(deliveries.map(d => [d.kind, d.subscriptionId]).sort(), [
      ['GUEST_REQUEST', adminIds[0]], ['DISPATCHED', adminIds[0]], ['ASSIGNED', assignedIds[0]],
    ].sort());
    const stale = await ctx.prisma.pushDelivery.create({ data: {
      subscriptionId: unassignedIds[0], recipientRole: 'DRIVER', kind: 'PICKUP_WAITING', eventKey: `${ctx.prefix}:stale`,
      bookingId: booking.id, expiresAt: new Date(Date.now() + 60000),
    } });
    assert.equal((await tick()).status, 200);
    const rejected = await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: stale.id } });
    assert.equal(rejected.lastError, 'STALE_OR_UNAUTHORIZED');
    assert.equal(rejected.sentAt, null);
    const sent = transport().filter(item => item.payload.body.includes(booking.reference));
    assert.equal(sent.length, 3);
    assert.equal(sent.find(item => item.payload.data.url === '/driver').payload.data.bookingId, booking.id);
    const proof = sent.find(item => item.payload.data.subscriptionId === assignedIds[0]).payload.data.deviceToken;
    const userId = booking.driverId === driver.profile.id ? driver.id : other.id;
    await ctx.prisma.user.update({ where: { id: userId }, data: { status: 'SUSPENDED' } });
    assert.equal(await device(assignedIds[0], proof), 403);
  } finally { await cleanupGuest(ctx, references); }
});
