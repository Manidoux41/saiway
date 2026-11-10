import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('monthly entries, forecasts and rental/financing contracts support audited edits and soft deletion', async () => {
  const ctx = await setup();
  const entries = [], forecasts = [];
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: ctx.prefix, seats: 4, active: false } });
    const cases = [
      ['accounting', { type: 'REVENUE', category: 'TRIP', label: ctx.prefix, amountCents: 3000, vehicleId: vehicle.id, paidAt: '2026-10-31T17:00:00Z', entryDate: '2026-10-31T17:00:00Z' }, { amountCents: 3500, entryDate: '2026-11-30T17:00:00Z', paidAt: null }],
      ['forecast', { month: '2026-11', expectedRevenueCents: 90000, expectedExpenseCents: 30000 }, { month: '2026-12', expectedRevenueCents: 120000, notes: 'Revised plan' }],
      ['contract', { vehicleId: vehicle.id, provider: ctx.prefix, monthlyCents: 30000, startsAt: '2025-01-01T00:00:00Z', endsAt: '2025-12-01T00:00:00Z', status: 'ACTIVE', kind: 'FINANCING' }, { monthlyCents: 32000, kind: 'RENTAL' }],
    ];
    for (const [entity, data, changes] of cases) {
      for (const cookie of [undefined, driver.cookie]) assert.equal((await request('/api/admin/management', 'POST', { entity, data }, cookie)).status, 403);
      const created = await request('/api/admin/management', 'POST', { entity, data }, ctx.cookie);
      assert.equal(created.status, 201);
      let item = created.data.item;
      if (entity === 'accounting') entries.push(item.id);
      if (entity === 'forecast') forecasts.push(item.id);
      const command = { entity, id: item.id, data: { ...changes, expectedUpdatedAt: item.updatedAt, reason: 'Correct source document' } };
      assert.equal((await request('/api/admin/management', 'PATCH', command, driver.cookie)).status, 403);
      assert.equal((await request('/api/admin/management', 'DELETE', { entity, id: item.id, data: { expectedUpdatedAt: item.updatedAt, reason: ' ' } }, ctx.cookie)).status, 400);
      const concurrent = await Promise.all([request('/api/admin/management', 'PATCH', command, ctx.cookie), request('/api/admin/management', 'PATCH', command, ctx.cookie)]);
      assert.deepEqual(concurrent.map(response => response.status).sort(), [200, 409]);
      item = concurrent.find(response => response.status === 200).data.item;
      for (const [key, value] of Object.entries(changes)) assert.equal(item[key], value && (key.endsWith('At') || key === 'entryDate') ? new Date(value).toISOString() : key === 'month' ? `${value}-01T00:00:00.000Z` : value);
      assert.equal((await request('/api/admin/management', 'DELETE', { entity, id: item.id, data: { expectedUpdatedAt: created.data.item.updatedAt, reason: 'Stale version' } }, ctx.cookie)).status, 409);
      const remove = { entity, id: item.id, data: { expectedUpdatedAt: item.updatedAt, reason: 'Remove incorrect record' } };
      assert.equal((await request('/api/admin/management', 'DELETE', remove, driver.cookie)).status, 403);
      assert.equal((await request('/api/admin/management', 'DELETE', remove, ctx.cookie)).status, 200);
      const model = entity === 'accounting' ? ctx.prisma.accountingEntry : entity === 'forecast' ? ctx.prisma.forecastLine : ctx.prisma.vehicleContract;
      assert.ok((await model.findUniqueOrThrow({ where: { id: item.id } })).deletedAt);
      const listed = (await request('/api/admin/management', 'GET', undefined, ctx.cookie)).data;
      if (entity === 'accounting') assert.ok(listed.entries.find(row => row.id === item.id).deletedAt);
      else assert.ok(!listed[entity === 'forecast' ? 'forecasts' : 'contracts'].some(row => row.id === item.id));
      const audit = await ctx.prisma.auditLog.findFirstOrThrow({ where: { entityId: item.id, action: 'DELETE' } });
      assert.equal(audit.metadata.reason, 'Remove incorrect record');
      assert.equal(audit.metadata.before.id, item.id);
      assert.equal((await request('/api/admin/management', 'PATCH', { ...command, data: { ...command.data, expectedUpdatedAt: item.updatedAt } }, ctx.cookie)).status, 409);
    }
    assert.equal((await request('/api/admin/management', 'POST', { entity: 'contract', data: { ...cases[2][1], endsAt: '2024-01-01T00:00:00Z' } }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/management', 'POST', { entity: 'accounting', data: { ...cases[0][1], sourceKey: 'payment:fake' } }, ctx.cookie)).status, 400);
  } finally {
    await ctx.prisma.accountingEntry.deleteMany({ where: { id: { in: entries } } });
    await ctx.prisma.forecastLine.deleteMany({ where: { id: { in: forecasts } } });
    await ctx.cleanup();
  }
});

test('legacy trip receipts can be corrected or removed without changing payments or reappearing after confirmation', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } });
    const booking = await ctx.prisma.booking.create({ data: {
      reference: `${ctx.prefix}-legacy`, driverId: profile.id, originType: 'DRIVER', passengerName: 'Validation',
      fromAddress: 'SAI Airport', toAddress: 'Siem Reap', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER',
      pickupAt: new Date(), status: 'TRIP_COMPLETED', priceCents: 3000, passengers: 1,
    } });
    const payment = await ctx.prisma.payment.create({ data: { bookingId: booking.id, provider: 'DRIVER_DIRECT', providerRef: randomUUID(), amountCents: 3000, currency: 'USD', status: 'PAID', confirmedAt: new Date(), collectionMethod: 'CASH' } });
    const correction = await request('/api/admin/management', 'PATCH', { entity: 'accounting', id: `payment:${payment.id}`, data: { expectedUpdatedAt: payment.updatedAt.toISOString(), reason: 'Legacy receipt accounting correction', amountCents: 2700 } }, ctx.cookie);
    assert.equal(correction.status, 200);
    const entry = correction.data.item;
    assert.equal(entry.amountCents, 2700);
    assert.equal(entry.sourceKey, `payment:${payment.id}`);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'accounting', id: entry.id, data: { expectedUpdatedAt: entry.updatedAt, reason: 'Invalid source change', type: 'EXPENSE' } }, ctx.cookie)).status, 409);
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'accounting', id: entry.id, data: { expectedUpdatedAt: entry.updatedAt, reason: 'Exclude from monthly accounts' } }, ctx.cookie)).status, 200);
    assert.equal((await request('/api/driver/payments', 'POST', { bookingId: booking.id, received: true, collectionMethod: 'CASH' }, driver.cookie)).status, 200);
    const original = await ctx.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    assert.equal(original.amountCents, 3000);
    assert.equal(original.status, 'PAID');
    assert.equal(await ctx.prisma.accountingEntry.count({ where: { sourceKey: entry.sourceKey } }), 1);
    assert.ok((await ctx.prisma.accountingEntry.findUniqueOrThrow({ where: { id: entry.id } })).deletedAt);
  } finally { await ctx.cleanup(); }
});
