import { test } from 'node:test';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('administrators and drivers change only their own password with persisted hashes and verified current credentials', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const customer = await createAccount(ctx, 'CUSTOMER');
    const accounts = [{ id: ctx.id, email: ctx.email, cookie: ctx.cookie }, driver];
    const replacement = `${ctx.password}-new`;
    const body = { currentPassword: ctx.password, newPassword: replacement, confirmPassword: replacement };
    assert.equal((await request('/api/account/password', 'POST', body)).status, 403);
    assert.equal((await request('/api/account/password', 'POST', body, customer.cookie)).status, 403);
    const customerHash = (await ctx.prisma.user.findUnique({ where: { id: customer.id } })).passwordHash;
    for (const account of accounts) {
      const before = await ctx.prisma.user.findUnique({ where: { id: account.id } });
      for (const invalid of [
        { ...body, currentPassword: 'incorrect' },
        { ...body, newPassword: 'short', confirmPassword: 'short' },
        { ...body, confirmPassword: `${replacement}-different` },
        { ...body, newPassword: ctx.password, confirmPassword: ctx.password },
        { ...body, newPassword: 'x'.repeat(129), confirmPassword: 'x'.repeat(129) },
        { ...body, id: customer.id },
        { ...body, role: 'CUSTOMER' },
      ]) assert.equal((await request('/api/account/password', 'POST', invalid, account.cookie)).status, 400);
      assert.equal((await ctx.prisma.user.findUnique({ where: { id: account.id } })).passwordHash, before.passwordHash);
      const changed = await request('/api/account/password', 'POST', body, account.cookie);
      assert.equal(changed.status, 200); assert.deepEqual(changed.data, { ok: true });
      const stored = await ctx.prisma.user.findUnique({ where: { id: account.id } });
      assert.notEqual(stored.passwordHash, before.passwordHash);
      assert.notEqual(stored.passwordHash, replacement);
      assert.equal(stored.role, before.role); assert.equal(stored.status, before.status);
      const parts = stored.passwordHash.split('$');
      assert.equal(parts[0], 'scrypt');
      assert.ok(timingSafeEqual(Buffer.from(parts[5], 'base64'), scryptSync(replacement, parts[4], 64, { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]) })));
      assert.equal((await request('/api/auth/login', 'POST', { email: account.email, password: ctx.password })).status, 401);
      const login = await request('/api/auth/login', 'POST', { email: account.email, password: replacement });
      assert.equal(login.status, 200); assert.equal(login.data.user.id, account.id);
      assert.equal((await request('/api/account/password', 'POST', { ...body, currentPassword: ctx.password }, account.cookie)).status, 400);
      const audit = await ctx.prisma.auditLog.findMany({ where: { actorId: account.id, action: 'PASSWORD_CHANGE' } });
      assert.equal(audit.length, 1); assert.equal(audit[0].entityId, account.id);
      assert.ok(!JSON.stringify(audit).includes(replacement));
    }
    assert.equal((await ctx.prisma.user.findUnique({ where: { id: customer.id } })).passwordHash, customerHash);
    await ctx.prisma.user.update({ where: { id: driver.id }, data: { status: 'SUSPENDED' } });
    assert.equal((await request('/api/account/password', 'POST', { currentPassword: replacement, newPassword: `${replacement}-next`, confirmPassword: `${replacement}-next` }, driver.cookie)).status, 403);
  } finally { await ctx.cleanup(); }
});
