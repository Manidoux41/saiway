import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { assert, request, setup, createAccount } from './helpers.mjs';
test('driver fuel declarations enforce ownership, dates and odometers; approval converts once and rejection does not spend', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const other = await createAccount(ctx, 'DRIVER', 'other');
    const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } });
    await ctx.prisma.driverProfile.update({ where: { userId: driver.id }, data: { selectedVehicleId: vehicle.id } });
    const fuel = { requestId: randomUUID(), vehicleId: vehicle.id, occurredAt: '2026-10-01T10:00:00+07:00', odometerKm: '1000', liters: '20', amountCents: 40000, currency: 'KHR', khrPerUsd: '4000', fullTank: false };
    assert.equal((await request('/api/driver/vehicle-expenses', 'POST', fuel)).status, 403);
    assert.equal((await request('/api/driver/vehicle-expenses', 'POST', fuel, other.cookie)).status, 403);
    const created = await request('/api/driver/vehicle-expenses', 'POST', fuel, driver.cookie);
    assert.equal(created.status, 201);
    assert.equal(created.data.duplicate, false);
    assert.equal(created.data.expense.usdCents, 1000);
    assert.equal((await request('/api/driver/vehicle-expenses', 'POST', fuel, driver.cookie)).data.duplicate, true);
    assert.equal((await request('/api/driver/vehicle-expenses', 'POST', { ...fuel, liters: '21' }, driver.cookie)).status, 409);
    assert.equal(await ctx.prisma.accountingEntry.count({ where: { sourceKey: `vehicle-expense:${created.data.expense.id}` } }), 0);
    assert.equal((await request('/api/driver/vehicle-expenses', 'POST', { ...fuel, requestId: randomUUID(), occurredAt: '2026-10-02T10:00:00+07:00', odometerKm: '999' }, driver.cookie)).status, 409);
    assert.equal((await request('/api/driver/vehicle-expenses', 'POST', { ...fuel, requestId: randomUUID(), occurredAt: '2026-02-30T10:00:00+07:00' }, driver.cookie)).status, 400);
    const approve = { id: created.data.expense.id, action: 'APPROVE' };
    assert.equal((await request('/api/admin/vehicle-expenses', 'PATCH', approve, driver.cookie)).status, 403);
    const responses = await Promise.all([request('/api/admin/vehicle-expenses', 'PATCH', approve, ctx.cookie), request('/api/admin/vehicle-expenses', 'PATCH', approve, ctx.cookie)]);
    assert.ok(responses.every(response => response.status === 200));
    const entries = await ctx.prisma.accountingEntry.findMany({ where: { sourceKey: `vehicle-expense:${approve.id}` } });
    assert.equal(entries.length, 1); assert.equal(entries[0].amountCents, 1000); assert.equal(entries[0].category, 'FUEL');
    assert.equal((await request('/api/admin/vehicle-expenses', 'PATCH', { id: approve.id, action: 'REJECT', reason: 'Cannot change approved' }, ctx.cookie)).status, 409);
    const maintenance = await request('/api/admin/vehicle-expenses', 'POST', { requestId: randomUUID(), vehicleId: vehicle.id, occurredAt: '2026-10-02T10:00:00+07:00', odometerKm: '1100', amountCents: 2500, currency: 'USD', notes: 'Oil change' }, ctx.cookie);
    assert.equal(maintenance.status, 201);
    assert.equal((await request('/api/admin/vehicle-expenses', 'PATCH', { id: maintenance.data.expense.id, action: 'REJECT', reason: 'Receipt needs correction' }, ctx.cookie)).status, 200);
    assert.equal(await ctx.prisma.accountingEntry.count({ where: { sourceKey: `vehicle-expense:${maintenance.data.expense.id}` } }), 0);
    const history = await request('/api/driver/vehicle-expenses', 'GET', undefined, driver.cookie);
    assert.equal(history.status, 200); assert.equal(history.data.expenses.length, 1);
    assert.equal((await request('/api/driver/vehicle-expenses', 'GET', undefined, other.cookie)).data.expenses.length, 0);
  } finally { await ctx.cleanup(); }
});
