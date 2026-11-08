import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { assert, request, setup, createAccount, base } from './helpers.mjs';
test('monthly payroll snapshots prorated fixed plus 80 percent eligible collections, excludes unpaid/sandbox and pays once', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const other = await createAccount(ctx, 'DRIVER', 'other');
    const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } });
    await ctx.prisma.employmentContract.create({ data: { driverId: profile.id, reference: `EC-${randomUUID()}`, status: 'ACTIVE', position: 'Driver', workplace: 'Siem Reap', startsAt: new Date('2026-10-15'), monthlySalaryCents: 31000 } });
    const trip = { driverId: profile.id, fromAddress: 'SAI Airport', toAddress: 'Hotel', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER', status: 'TRIP_COMPLETED', pickupAt: new Date('2026-10-20T02:00:00Z'), completedAt: new Date('2026-10-20T03:00:00Z'), priceCents: 9000, passengers: 1, originType: 'DRIVER' };
    const paid = await ctx.prisma.booking.create({ data: { ...trip, reference: `SW-${randomUUID()}`, payments: { create: [{ provider: 'DRIVER_DIRECT', status: 'PAID', amountCents: 9000, confirmedAt: new Date('2026-11-04'), currency: 'USD' }, { provider: 'ABA_PAYWAY_SANDBOX', status: 'PAID', amountCents: 99999, currency: 'USD' }] } } });
    await ctx.prisma.booking.create({ data: { ...trip, reference: `SW-${randomUUID()}` } });
    const body = { driverId: profile.id, month: '2026-10', bonusCents: 500, deductionCents: 100, adjustmentNotes: 'Bonus 5 USD; contribution 1 USD (manual).' };
    assert.equal((await request('/api/admin/payroll', 'POST', body, driver.cookie)).status, 403);
    const draft = await request('/api/admin/payroll', 'POST', body, ctx.cookie);
    assert.equal(draft.status, 201); const id = draft.data.payroll.id;
    assert.equal(draft.data.payroll.baseSalaryCents, 17000);
    assert.equal(draft.data.payroll.commissionCents, 7200);
    assert.equal(draft.data.payroll.netCents, 24600);
    assert.equal(draft.data.payroll.snapshot.unpaidTrips, 1);
    assert.equal(draft.data.payroll.scheduledPayAt, '2026-11-25T17:00:00.000Z');
    const recalculated = await request('/api/admin/payroll', 'POST', body, ctx.cookie);
    assert.equal(recalculated.data.payroll.id, id);
    const finalize = { id, action: 'FINALIZE', expectedUpdatedAt: recalculated.data.payroll.updatedAt };
    assert.equal((await request('/api/driver/payroll', 'GET', undefined, driver.cookie)).data.payrolls.length, 0);
    assert.equal(await ctx.prisma.accountingEntry.count({ where: { sourceKey: `payroll:${id}` } }), 0);
    assert.equal((await request('/api/admin/payroll', 'PATCH', { ...finalize, expectedUpdatedAt: '2000-01-01T00:00:00.000Z' }, ctx.cookie)).status, 409);
    await ctx.prisma.employmentContract.updateMany({ where: { driverId: profile.id }, data: { monthlySalaryCents: 33000 } });
    assert.equal((await request('/api/admin/payroll', 'PATCH', finalize, ctx.cookie)).status, 409);
    assert.equal((await ctx.prisma.payroll.findUniqueOrThrow({ where: { id } })).status, 'DRAFT');
    await ctx.prisma.employmentContract.updateMany({ where: { driverId: profile.id }, data: { monthlySalaryCents: 31000 } });
    assert.equal((await request('/api/admin/payroll', 'PATCH', finalize, ctx.cookie)).status, 200);
    assert.equal((await request('/api/admin/payroll', 'POST', body, ctx.cookie)).status, 409);
    await ctx.prisma.payment.updateMany({ where: { bookingId: paid.id, provider: 'DRIVER_DIRECT' }, data: { amountCents: 1000 } });
    assert.equal((await request('/api/admin/payroll', 'PATCH', finalize, ctx.cookie)).data.payroll.netCents, 24600);
    assert.equal((await request('/api/driver/payroll', 'GET', undefined, driver.cookie)).data.payrolls[0].id, id);
    assert.equal((await request('/api/driver/payroll', 'GET', undefined, other.cookie)).data.payrolls.length, 0);
    for (const language of ['en', 'fr', 'km']) {
      const pdf = await fetch(`${base}/api/driver/payroll/${id}/pdf?language=${language}`, { headers: { Cookie: driver.cookie } });
      assert.equal(pdf.status, 200); assert.equal(pdf.headers.get('content-type'), 'application/pdf'); assert.equal(Buffer.from(await pdf.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
    }
    assert.equal((await fetch(`${base}/api/driver/payroll/${id}/pdf`, { headers: { Cookie: other.cookie } })).status, 404);
    const payment = { id, action: 'PAID', paidAt: '2026-11-05T05:00:00.000Z' };
    assert.equal((await request('/api/admin/payroll', 'PATCH', payment, ctx.cookie)).status, 200);
    assert.equal((await request('/api/admin/payroll', 'PATCH', payment, ctx.cookie)).status, 200);
    assert.equal(await ctx.prisma.accountingEntry.count({ where: { sourceKey: `payroll:${id}`, amountCents: 24600, category: 'SALARY' } }), 1);
  } finally { await ctx.cleanup(); }
});
