import { test } from 'node:test';
import { assert, request, setup } from './helpers.mjs';

test('fleet, accounting and forecast records persist and can be managed', async () => {
  const ctx = await setup();
  let vehicleId, entryId, forecastId;
  try {
    const vehicle = { entity: 'vehicle', data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } };
    assert.equal((await request('/api/admin/management', 'POST', vehicle)).status, 403);
    const createdVehicle = await request('/api/admin/management', 'POST', vehicle, ctx.cookie);
    assert.equal(createdVehicle.status, 201);
    vehicleId = createdVehicle.data.item.id;
    assert.equal((await ctx.prisma.vehicle.findUnique({ where: { id: vehicleId } })).seats, 4);
    const createdEntry = await request('/api/admin/management', 'POST', { entity: 'accounting', data: { type: 'REVENUE', label: ctx.prefix, amountCents: 1250 } }, ctx.cookie);
    assert.equal(createdEntry.status, 201);
    entryId = createdEntry.data.item.id;
    assert.equal((await ctx.prisma.accountingEntry.findUnique({ where: { id: entryId } })).amountCents, 1250);
    const createdForecast = await request('/api/admin/management', 'POST', { entity: 'forecast', data: { month: '2026-11', expectedRevenueCents: 2000, expectedExpenseCents: 500 } }, ctx.cookie);
    assert.equal(createdForecast.status, 201);
    forecastId = createdForecast.data.item.id;
    assert.equal((await ctx.prisma.forecastLine.findUnique({ where: { id: forecastId } })).expectedRevenueCents, 2000);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'vehicle', id: vehicleId, data: { seats: 6 } }, ctx.cookie)).status, 200);
    assert.equal((await ctx.prisma.vehicle.findUnique({ where: { id: vehicleId } })).seats, 6);
    const listing = await request('/api/admin/management', 'GET', undefined, ctx.cookie);
    assert.equal(listing.status, 200);
    assert.ok(listing.data.vehicles.some(row => row.id === vehicleId));
    assert.ok(listing.data.entries.some(row => row.id === entryId));
    assert.ok(listing.data.forecasts.some(row => row.id === forecastId));
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'vehicle', id: vehicleId }, ctx.cookie)).status, 200);
    assert.equal((await ctx.prisma.vehicle.findUnique({ where: { id: vehicleId } })).active, false);
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'accounting', id: entryId }, ctx.cookie)).status, 200);
    assert.equal(await ctx.prisma.accountingEntry.findUnique({ where: { id: entryId } }), null);
  } finally {
    try {
      if (vehicleId) await ctx.prisma.vehicle.deleteMany({ where: { id: vehicleId } });
      if (entryId) await ctx.prisma.accountingEntry.deleteMany({ where: { id: entryId } });
      if (forecastId) await ctx.prisma.forecastLine.deleteMany({ where: { id: forecastId } });
    } finally { await ctx.cleanup(); }
  }
});
