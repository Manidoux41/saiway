import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('verified deletion requests persist, are private and can be acknowledged by administrators', async () => {
  const database = new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL);
  assert.ok(['127.0.0.1', 'localhost'].includes(database.hostname) && database.pathname.includes('validation'), 'Use an isolated local validation database');
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const other = await createAccount(ctx, 'CUSTOMER', 'other');
    const body = { password: ctx.password, confirmed: true };
    assert.equal((await request('/api/account/deletion', 'POST', body)).status, 401);
    assert.equal((await request('/api/account/deletion', 'POST', { ...body, password: 'wrong-password' }, customer.cookie)).status, 403);
    assert.equal((await request('/api/account/deletion', 'POST', { ...body, confirmed: false }, customer.cookie)).status, 400);
    const submitted = await request('/api/account/deletion', 'POST', body, customer.cookie);
    assert.equal(submitted.status, 202);
    const id = submitted.data.deletion.id;
    assert.equal((await request('/api/account/deletion', 'POST', body, customer.cookie)).data.deletion.id, id);
    assert.equal(await ctx.prisma.accountDeletionRequest.count({ where: { userId: customer.id } }), 1);
    assert.equal((await request('/api/account/deletion', 'GET', undefined, other.cookie)).data.deletion, null);
    assert.equal((await request('/api/admin/account-deletions', 'GET', undefined, customer.cookie)).status, 403);
    const inbox = await request('/api/admin/account-deletions', 'GET', undefined, ctx.cookie);
    assert.equal(inbox.status, 200);
    assert.ok(inbox.data.requests.some(item => item.id === id));
    const resolution = { id, status: 'LIMITED', resolution: 'Fixture processing recorded; no real user data. Legal retention explained to fixture user.' };
    assert.equal((await request('/api/admin/account-deletions', 'PATCH', resolution, other.cookie)).status, 403);
    assert.equal((await request('/api/admin/account-deletions', 'PATCH', resolution, ctx.cookie)).status, 200);
    assert.equal((await request('/api/admin/account-deletions', 'PATCH', resolution, ctx.cookie)).status, 409);
    const stored = await ctx.prisma.accountDeletionRequest.findUniqueOrThrow({ where: { id } });
    assert.equal(stored.status, 'LIMITED');
    assert.ok(stored.resolvedAt);
    assert.equal(await ctx.prisma.auditLog.count({ where: { actorId: ctx.id, entityId: id } }), 1);
    assert.equal(await ctx.prisma.user.count({ where: { id: customer.id } }), 1, 'Acknowledging a manual request must not pretend to automatically erase the account');
  } finally { await ctx.cleanup(); }
});
