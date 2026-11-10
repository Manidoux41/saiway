import test from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';
import { registerProfessional, reviewInput, professionalBooking } from './professional-helpers.mjs';

test('administrator reviews and edits professional registrations with authorization, optimistic concurrency and audited status transitions', async () => {
  const ctx = await setup();
  try {
    const pro = await registerProfessional(ctx);
    const driver = await createAccount(ctx, 'DRIVER');
    const endpoint = `/api/admin/professionals/${pro.profile.id}`;
    assert.equal((await request('/api/admin/professionals')).status, 403);
    for (const cookie of [undefined, pro.cookie, driver.cookie]) {
      assert.equal((await request(endpoint, 'PATCH', reviewInput(pro.profile, { status: 'APPROVED' }), cookie)).status, 403);
    }
    const listed = await request('/api/admin/professionals', 'GET', undefined, ctx.cookie);
    assert.equal(listed.status, 200);
    assert.ok(listed.data.professionals.some(item => item.id === pro.profile.id && item.user.email === pro.input.email));
    assert.ok(!JSON.stringify(listed.data).includes('passwordHash'));
    assert.equal((await request(endpoint, 'PATCH', reviewInput(pro.profile, { status: 'ACTIVE' }), ctx.cookie)).status, 400);
    const approved = await request(endpoint, 'PATCH', reviewInput(pro.profile, { status: 'APPROVED', companyName: 'Updated validation hotel', contactPhone: '+855 98 765 432' }), ctx.cookie);
    assert.equal(approved.status, 200);
    assert.equal((await request(endpoint, 'PATCH', reviewInput(pro.profile, { status: 'REJECTED' }), ctx.cookie)).status, 409);
    let profile = approved.data.professional;
    for (const status of ['SUSPENDED', 'REJECTED', 'PENDING', 'APPROVED']) {
      const updated = await request(endpoint, 'PATCH', reviewInput(profile, { status }), ctx.cookie);
      assert.equal(updated.status, 200);
      profile = updated.data.professional;
      assert.equal((await request('/api/professionals', 'GET', undefined, pro.cookie)).data.professional.status, status);
      if (status !== 'APPROVED') assert.equal((await request('/api/bookings', 'POST', professionalBooking(), pro.cookie)).status, 403);
    }
    assert.equal(await ctx.prisma.auditLog.count({ where: { entityId: profile.id, action: 'REVIEW' } }), 5);
    const persisted = await ctx.prisma.professionalProfile.findUniqueOrThrow({ where: { id: profile.id } });
    assert.equal(persisted.companyName, 'Updated validation hotel');
    assert.ok(persisted.reviewedAt);
    assert.equal((await ctx.prisma.customerProfile.findUniqueOrThrow({ where: { userId: profile.userId } })).company, persisted.companyName);
  } finally { await ctx.cleanup(); }
});
