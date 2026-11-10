import test from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';
import { randomUUID } from 'node:crypto';

test('confirmed receipts persist one dated accounting source; corrections change only accounts and are audited', async () => {
  const ctx = await setup();
  let manualId;
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } });
    const booking = await ctx.prisma.booking.create({ data: { reference: `SW-${randomUUID()}`, originType: 'DRIVER', passengerName: 'Local test', driverId: profile.id, fromAddress: 'SAI Airport', toAddress: 'Siem Reap', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER', pickupAt: new Date(), status: 'TRIP_COMPLETED', priceCents: 3000, passengers: 1 } });
    const receipt = { bookingId: booking.id, received: true, collectionMethod: 'CASH' };
    assert.equal((await request('/api/driver/payments', 'POST', receipt)).status, 403);
    assert.equal((await request('/api/driver/payments', 'POST', receipt, driver.cookie)).status, 200);
    assert.equal((await request('/api/driver/payments', 'POST', receipt, driver.cookie)).status, 200);
    const payment = await ctx.prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    assert.ok(payment.confirmedAt);
    const entries = await ctx.prisma.accountingEntry.findMany({ where: { sourceKey: `payment:${payment.id}` } });
    assert.equal(entries.length, 1);
    assert.equal(entries[0].amountCents, 3000);
    assert.equal(entries[0].entryDate.getTime(), payment.confirmedAt.getTime());
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'accounting', id: entries[0].id, data: { amountCents: 1, expectedUpdatedAt: entries[0].updatedAt.toISOString() } }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'accounting', id: entries[0].id, data: { amountCents: 2900, expectedUpdatedAt: entries[0].updatedAt.toISOString(), reason: 'Correct bookkeeping amount only' } }, ctx.cookie)).status, 200);
    assert.equal((await ctx.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).amountCents, 3000);
    assert.equal((await request('/api/driver/payments', 'POST', receipt, driver.cookie)).status, 200);
    assert.equal((await ctx.prisma.accountingEntry.findUniqueOrThrow({ where: { id: entries[0].id } })).amountCents, 2900);
    const created = await request('/api/admin/management', 'POST', { entity: 'accounting', data: { type: 'EXPENSE', category: 'OTHER', label: ctx.prefix, amountCents: 200, entryDate: '2026-10-31T17:00:00.000Z' } }, ctx.cookie);
    assert.equal(created.status, 201);
    manualId = created.data.item.id;
    const update = { entity: 'accounting', id: manualId, data: { amountCents: 250, notes: 'Correction fixture', reason: 'Correct amount', expectedUpdatedAt: created.data.item.updatedAt } };
    assert.equal((await request('/api/admin/management', 'PATCH', update, ctx.cookie)).status, 200);
    assert.equal((await request('/api/admin/management', 'PATCH', update, ctx.cookie)).status, 409);
    const corrected = await ctx.prisma.accountingEntry.findUniqueOrThrow({ where: { id: manualId } });
    assert.equal(corrected.amountCents, 250);
    assert.equal(corrected.entryDate.toISOString(), '2026-10-31T17:00:00.000Z');
    assert.ok(await ctx.prisma.auditLog.findFirst({ where: { entityId: manualId, action: 'CORRECT' } }));
    const listed = await request('/api/admin/management', 'GET', undefined, ctx.cookie);
    assert.equal(listed.status, 200);
    assert.ok(listed.data.entries.some(entry => entry.sourceKey === `payment:${payment.id}`));
  } finally {
    if (manualId) await ctx.prisma.accountingEntry.deleteMany({ where: { id: manualId } });
    await ctx.cleanup();
  }
});
