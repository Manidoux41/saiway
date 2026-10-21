import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { assert, request, setup } from './helpers.mjs';

test('customer session survives browser restart and seven days, renews and is revoked by logout', async () => {
  const ctx = await setup();
  try {
    const registered = await request('/api/auth/register', 'POST', { name: ctx.prefix, email: `${ctx.prefix}-persistent@example.invalid`, password: ctx.password });
    assert.equal(registered.status, 201);
    assert.match(registered.setCookie, /HttpOnly; SameSite=Lax; Max-Age=34560000/);
    const token = registered.cookie.split('=')[1];
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const session = await ctx.prisma.customerSession.findUniqueOrThrow({ where: { tokenHash } });
    assert.notEqual(session.tokenHash, token);
    await ctx.prisma.customerSession.update({ where: { tokenHash }, data: { createdAt: new Date(Date.now() - 365 * 86400000) } });
    assert.equal((await request('/api/account/profile', 'GET', undefined, registered.cookie)).status, 200);
    const renewed = await request('/api/auth/session', 'POST', undefined, registered.cookie);
    assert.equal(renewed.status, 200);
    assert.equal(renewed.cookie, registered.cookie);
    assert.match(renewed.setCookie, /Max-Age=34560000/);
    assert.equal((await request('/api/auth/session', 'POST')).status, 403);
    assert.equal((await request('/api/auth/session', 'POST', undefined, ctx.cookie)).status, 403);
    const logout = await request('/api/auth/logout', 'POST', undefined, registered.cookie);
    assert.equal(logout.status, 200);
    assert.match(logout.setCookie, /Max-Age=0/);
    assert.equal(await ctx.prisma.customerSession.count({ where: { tokenHash } }), 0);
    assert.equal((await request('/api/account/profile', 'GET', undefined, registered.cookie)).status, 403);
    assert.equal((await request('/api/auth/session', 'POST', undefined, registered.cookie)).status, 403);
  } finally { await ctx.cleanup(); }
});

test('customer persistent login respects suspension and detects modified tokens', async () => {
  const ctx = await setup();
  try {
    const body = { name: ctx.prefix, email: `${ctx.prefix}-login@example.invalid`, password: ctx.password };
    const registered = await request('/api/auth/register', 'POST', body);
    assert.equal(registered.status, 201);
    const login = await request('/api/auth/login', 'POST', body);
    assert.equal(login.status, 200);
    assert.match(login.setCookie, /Max-Age=34560000/);
    assert.notEqual(login.cookie, registered.cookie);
    assert.equal((await request('/api/account/profile', 'GET', undefined, login.cookie)).status, 200);
    assert.equal((await request('/api/account/profile', 'GET', undefined, `${login.cookie.slice(0, -1)}z`)).status, 403);
    await ctx.prisma.user.update({ where: { id: registered.data.user.id }, data: { status: 'SUSPENDED' } });
    assert.equal((await request('/api/account/profile', 'GET', undefined, login.cookie)).status, 403);
    assert.equal((await request('/api/auth/session', 'POST', undefined, login.cookie)).status, 403);
    assert.equal((await request('/api/auth/logout', 'POST', undefined, login.cookie)).status, 200);
  } finally { await ctx.cleanup(); }
});
