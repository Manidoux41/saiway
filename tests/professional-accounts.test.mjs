import test from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';
import { professionalInput, registerProfessional, professionalBooking, professionalQuote } from './professional-helpers.mjs';

test('professional registration saves company details and a pending account session without allowing bookings or exposing the directory', async () => {
  const ctx = await setup();
  try {
    const input = professionalInput(ctx);
    for (const forged of [{ status: 'APPROVED' }, { role: 'ADMIN' }, { contactPhone: 'invalid' }, { category: 'FAKE' }, { password: 'short' }]) {
      assert.equal((await request('/api/professionals', 'POST', { ...input, ...forged })).status, 400);
    }
    const pro = await registerProfessional(ctx);
    assert.equal(pro.profile.status, 'PENDING');
    assert.equal(pro.profile.companyName, input.companyName);
    const persisted = await ctx.prisma.user.findUniqueOrThrow({ where: { email: input.email }, include: { professional: true, customer: true } });
    assert.equal(persisted.role, 'CUSTOMER');
    assert.notEqual(persisted.passwordHash, ctx.password);
    assert.equal(persisted.customer.company, input.companyName);
    assert.equal(persisted.professional.status, 'PENDING');
    assert.equal((await request('/api/professionals', 'POST', input)).status, 409);
    assert.equal((await request('/api/professionals', 'POST', professionalInput(ctx, 'signed-in'), pro.cookie)).status, 403);
    assert.equal((await request('/api/professionals')).status, 403);
    assert.equal((await request(professionalQuote, 'GET', undefined, pro.cookie)).status, 403);
    assert.equal((await request('/api/bookings', 'POST', professionalBooking(), pro.cookie)).status, 403);
    assert.equal(await ctx.prisma.booking.count({ where: { customerId: persisted.id } }), 0);
    assert.equal((await request('/api/admin/professionals', 'GET', undefined, pro.cookie)).status, 403);
    const customer = await createAccount(ctx, 'CUSTOMER');
    assert.equal((await request('/api/professionals', 'GET', undefined, customer.cookie)).data.professional, null);
    assert.equal((await request('/api/auth/logout', 'POST', {}, pro.cookie)).status, 200);
    const login = await request('/api/auth/login', 'POST', { email: input.email, password: ctx.password });
    assert.equal(login.status, 200);
    assert.equal((await request('/api/professionals', 'GET', undefined, login.cookie)).data.professional.status, 'PENDING');
  } finally { await ctx.cleanup(); }
});
