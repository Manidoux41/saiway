import { test } from 'node:test';
import { assert, request, setup, createAccount, base } from './helpers.mjs';

test('server pages and APIs enforce exact database roles, account switching and suspension', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const driver = await createAccount(ctx, 'DRIVER');
    const matrix = [
      [ctx.cookie, 'ADMIN', '/admin', ['/api/bookings', '/api/driver/bookings', '/api/account/profile'], ['/booking', '/account', '/driver', '/auth', '/']],
      [driver.cookie, 'DRIVER', '/driver', ['/api/bookings', '/api/admin/bookings', '/api/admin/management', '/api/account/profile'], ['/booking', '/account', '/admin', '/auth', '/']],
      [customer.cookie, 'CUSTOMER', '/account', ['/api/driver/bookings', '/api/admin/bookings', '/api/admin/management'], ['/driver', '/admin', '/auth']],
    ];
    for (const [cookie, role, home, forbiddenApis, forbiddenPages] of matrix) {
      for (const path of forbiddenApis) assert.equal((await request(path, 'GET', undefined, cookie)).status, 403, `${role}: ${path}`);
      for (const path of forbiddenPages) {
        const response = await fetch(`${base}${path}`, { headers: { Cookie: cookie }, redirect: 'manual' });
        assert.equal(response.status, 307, `${role}: ${path}`);
        assert.equal(new URL(response.headers.get('location'), base).pathname, home);
      }
      const html = await (await fetch(`${base}${home}`, { headers: { Cookie: cookie } })).text();
      assert.ok(!html.includes('localStorage.getItem("saiway-user")'));
      if (role !== 'CUSTOMER') assert.ok(!/href="\/booking(?:[/?"])/.test(html), `${role} must not have booking navigation`);
      assert.equal((await request('/api/auth/register', 'POST', { name: 'Blocked', email: `${ctx.prefix}-blocked@example.invalid`, password: ctx.password }, cookie)).status, 403);
    }
    for (const account of [customer, driver]) {
      assert.equal((await request('/api/admin/users', 'POST', { name: 'Forbidden', email: `${ctx.prefix}-forbidden@example.invalid`, password: ctx.password, role: 'ADMIN' }, account.cookie)).status, 403);
      assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'user', id: ctx.id, data: { status: 'SUSPENDED' } }, account.cookie)).status, 403);
      assert.equal((await request('/api/auth/login', 'POST', { email: account.email, password: ctx.password, role: 'ADMIN' })).status, 401);
    }
    assert.equal((await request('/api/auth/login', 'POST', { email: customer.email, password: ctx.password }, driver.cookie)).status, 403);
    assert.equal((await request('/api/auth/register', 'POST', { name: 'Blocked', email: `${ctx.prefix}-blocked@example.invalid`, password: ctx.password, role: 'ADMIN' })).status, 403);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'user', id: customer.id, data: { role: 'ADMIN' } }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'user', id: ctx.id }, ctx.cookie)).status, 409);
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'user', id: driver.id }, ctx.cookie)).status, 200);
    assert.equal((await request('/api/driver/bookings', 'GET', undefined, driver.cookie)).status, 403);
    assert.equal((await ctx.prisma.user.findUnique({ where: { id: driver.id } })).status, 'SUSPENDED');
    await ctx.prisma.user.update({ where: { id: customer.id }, data: { role: 'DRIVER' } });
    assert.equal((await request('/api/bookings', 'GET', undefined, customer.cookie)).status, 403);
    assert.equal((await request('/api/driver/bookings', 'GET', undefined, customer.cookie)).status, 403);
    assert.equal((await request('/api/auth/logout', 'POST', {}, ctx.cookie)).status, 200);
  } finally { await ctx.cleanup(); }
});
