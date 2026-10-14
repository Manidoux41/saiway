import { test } from 'node:test';
import { assert, request, setup } from './helpers.mjs';

test('customer registration, profile persistence, role isolation and login', async () => {
  const ctx = await setup();
  try {
    const body = { name: 'Validation Customer', email: `${ctx.prefix}-customer@example.invalid`, password: ctx.password };
    assert.equal((await request('/api/account/profile')).status, 403);
    const registered = await request('/api/auth/register', 'POST', body);
    assert.equal(registered.status, 201);
    assert.equal(registered.data.user.role, 'customer');
    const cookie = registered.cookie;
    assert.ok(cookie);
    const updated = await request('/api/account/profile', 'PATCH', { name: 'Updated Validation', phone: '+85512345678', address: 'Validation address', paymentBrand: 'VISA', paymentLast4: '1234' }, cookie);
    assert.equal(updated.status, 200);
    const profile = await request('/api/account/profile', 'GET', undefined, cookie);
    assert.equal(profile.status, 200);
    assert.equal(profile.data.name, 'Updated Validation');
    assert.equal(profile.data.customer.address, 'Validation address');
    const stored = await ctx.prisma.user.findUnique({ where: { email: body.email }, include: { customer: true } });
    assert.equal(stored.customer.paymentLast4, '1234');
    assert.equal((await request('/api/admin/management', 'GET', undefined, cookie)).status, 403);
    assert.equal((await request('/api/auth/register', 'POST', body)).status, 409);
    assert.equal((await request('/api/auth/login', 'POST', { ...body, password: 'incorrect' })).status, 401);
    assert.equal((await request('/api/auth/login', 'POST', body)).status, 200);
  } finally { await ctx.cleanup(); }
});
