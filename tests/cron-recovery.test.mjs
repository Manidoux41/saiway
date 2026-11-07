import { test } from 'node:test';
import { createECDH, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { assert, request, setup, createAccount, base } from './helpers.mjs';

test('external recovery honors leases, backoff and retry limits and repeat/concurrent ticks do not resend completed work', async () => {
  const ctx = await setup();
  try {
    assert.ok(process.env.PUSH_VALIDATION_LOG);
    const customer = await createAccount(ctx, 'CUSTOMER');
    const ecdh = createECDH('prime256v1');
    ecdh.generateKeys();
    const endpoint = `https://fcm.googleapis.com/${ctx.prefix}/recovery`;
    const subscription = await ctx.prisma.pushSubscription.create({ data: {
      userId: customer.id, endpoint, p256dh: ecdh.getPublicKey().toString('base64url'), auth: randomBytes(16).toString('base64url'),
    } });
    const create = (name, changes = {}) => ctx.prisma.pushDelivery.create({ data: {
      subscriptionId: subscription.id, recipientRole: 'CUSTOMER', kind: 'TEST',
      eventKey: `${ctx.prefix}:${name}`, expiresAt: new Date(Date.now() + 300_000), ...changes,
    } });
    const abandoned = await create('abandoned', { attempts: 1, lockedUntil: new Date(Date.now() - 1000), lockToken: 'abandoned' });
    const locked = await create('locked', { attempts: 1, lockedUntil: new Date(Date.now() + 120_000), lockToken: 'in-flight' });
    const delayed = await create('backoff', { availableAt: new Date(Date.now() + 120_000) });
    const exhausted = await create('exhausted', { attempts: 5, lockedUntil: new Date(Date.now() - 1000), lockToken: 'last-attempt-interrupted' });
    const expired = await create('expired', { expiresAt: new Date(Date.now() - 1000) });
    const old = await create('old', { expiresAt: new Date(Date.now() - 8 * 86400_000) });
    const tick = () => fetch(`${base}/api/cron/push-notifications`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
    assert.equal((await request('/api/cron/push-notifications')).status, 401);
    assert.equal((await fetch(`${base}/api/cron/push-notifications`, { headers: { authorization: 'Bearer invalid' } })).status, 401);
    assert.ok((await Promise.all([tick(), tick()])).every(response => response.status === 200));
    const delivered = await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: abandoned.id } });
    assert.ok(delivered.sentAt);
    assert.equal(delivered.attempts, 2);
    assert.equal((await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id: exhausted.id } })).lastError, 'RETRY_LIMIT');
    assert.equal(await ctx.prisma.pushDelivery.count({ where: { id: old.id } }), 0);
    for (const id of [locked.id, delayed.id, expired.id]) assert.equal((await ctx.prisma.pushDelivery.findUniqueOrThrow({ where: { id } })).sentAt, null);
    await tick();
    const sent = readFileSync(process.env.PUSH_VALIDATION_LOG, 'utf8').trim().split('\n').map(line => JSON.parse(line)).filter(event => event.endpoint === endpoint);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].payload.tag, abandoned.eventKey);
  } finally { await ctx.cleanup(); }
});
