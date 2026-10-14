import { test } from 'node:test';
import { assert, request, setup } from './helpers.mjs';

test('driver creation, persistence, duplicate rejection, login and suspension', async () => {
  const ctx = await setup();
  try {
    const body = { name: 'Validation Driver', email: `${ctx.prefix}-driver@example.invalid`, password: ctx.password, role: 'DRIVER' };
    assert.equal((await request('/api/admin/users', 'POST', body)).status, 403);
    assert.equal((await request('/api/admin/users', 'POST', { ...body, password: 'short' }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/users', 'POST', { ...body, role: 'INVALID' }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/users', 'POST', { ...body, email: 'invalid-email' }, ctx.cookie)).status, 400);
    const created = await request('/api/admin/users', 'POST', { ...body, name: ` ${body.name} `, email: ` ${body.email.toUpperCase()} ` }, ctx.cookie);
    assert.equal(created.status, 201);
    assert.equal(created.data.user.email, body.email);
    assert.equal(created.data.user.name, body.name);
    const stored = await ctx.prisma.user.findUnique({ where: { email: body.email }, include: { driver: true } });
    assert.equal(stored.role, 'DRIVER');
    assert.equal(stored.status, 'ACTIVE');
    assert.ok(stored.driver);
    assert.notEqual(stored.passwordHash, ctx.password);
    const listing = await request('/api/admin/management', 'GET', undefined, ctx.cookie);
    assert.equal(listing.status, 200);
    assert.ok(listing.data.users.some(user => user.id === stored.id));
    assert.equal((await request('/api/admin/users', 'POST', body, ctx.cookie)).status, 409);
    const concurrentBody = { ...body, email: `${ctx.prefix}-concurrent@example.invalid` };
    const concurrent = await Promise.all([
      request('/api/admin/users', 'POST', concurrentBody, ctx.cookie),
      request('/api/admin/users', 'POST', concurrentBody, ctx.cookie),
    ]);
    assert.deepEqual(concurrent.map(result => result.status).sort(), [201, 409]);
    assert.equal(await ctx.prisma.user.count({ where: { email: concurrentBody.email } }), 1);
    assert.equal((await request('/api/auth/login', 'POST', { email: body.email, password: 'incorrect' })).status, 401);
    const login = await request('/api/auth/login', 'POST', body);
    assert.equal(login.status, 200);
    assert.equal(login.data.user.role, 'driver');
    assert.equal((await request('/api/admin/management', 'GET', undefined, login.cookie)).status, 403);
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'user', id: stored.id }, ctx.cookie)).status, 200);
    assert.equal((await ctx.prisma.user.findUnique({ where: { id: stored.id } })).status, 'SUSPENDED');
    assert.equal((await request('/api/auth/login', 'POST', body)).status, 401);
    assert.equal((await request('/api/driver/bookings', 'GET', undefined, login.cookie)).status, 403);
  } finally { await ctx.cleanup(); }
});
