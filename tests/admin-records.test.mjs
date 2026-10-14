import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('administrator edits driver profiles, archives fares and validates contract relations without losing history', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const customer = await createAccount(ctx, 'CUSTOMER');
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'user', id: driver.id, data: { isAvailable: false, licenseNo: 'VALIDATION', phone: '+85512345678' } }, ctx.cookie)).status, 200);
    const storedDriver = await ctx.prisma.user.findUnique({ where: { id: driver.id }, include: { driver: true } });
    assert.equal(storedDriver.driver.isAvailable, false);
    assert.equal(storedDriver.driver.licenseNo, 'VALIDATION');
    assert.equal(storedDriver.role, 'DRIVER');
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'user', id: customer.id, data: { isAvailable: true } }, ctx.cookie)).status, 400);
    const fare = await request('/api/admin/management', 'POST', { entity: 'pricing', data: { name: ctx.prefix, amountCents: 6700, active: false, direction: 'CITY_TO_AIRPORT', tripType: 'HOTEL_TRANSFER', effectiveAt: '2099-01-01T00:00:00Z' } }, ctx.cookie);
    assert.equal(fare.status, 201);
    const fareId = fare.data.item.id;
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'pricing', id: fareId, data: { amountCents: 6800 } }, ctx.cookie)).status, 200);
    const storedFare = await ctx.prisma.pricingRule.findUnique({ where: { id: fareId } });
    assert.equal(storedFare.active, false); assert.equal(storedFare.direction, 'CITY_TO_AIRPORT'); assert.equal(storedFare.tripType, 'HOTEL_TRANSFER');
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'pricing', id: fareId }, ctx.cookie)).status, 200);
    assert.ok(await ctx.prisma.pricingRule.findUnique({ where: { id: fareId } }));
    const vehicle = await request('/api/admin/management', 'POST', { entity: 'vehicle', data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } }, ctx.cookie);
    assert.equal(vehicle.status, 201);
    const vehicleId = vehicle.data.item.id;
    const contractBody = { entity: 'contract', data: { vehicleId, provider: ctx.prefix, monthlyCents: 30000, status: 'ACTIVE', startsAt: '2099-02-01T00:00:00Z', endsAt: '2099-03-01T00:00:00Z' } };
    assert.equal((await request('/api/admin/management', 'POST', contractBody, customer.cookie)).status, 403);
    const contract = await request('/api/admin/management', 'POST', contractBody, ctx.cookie);
    assert.equal(contract.status, 201);
    const contractId = contract.data.item.id;
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'contract', id: contractId, data: { endsAt: '2099-01-01T00:00:00Z' } }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'contract', id: contractId, data: { monthlyCents: 31000 } }, ctx.cookie)).status, 200);
    assert.equal((await ctx.prisma.vehicleContract.findUnique({ where: { id: contractId } })).startsAt.toISOString(), '2099-02-01T00:00:00.000Z');
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'contract', id: contractId }, ctx.cookie)).status, 200);
    assert.equal((await ctx.prisma.vehicleContract.findUnique({ where: { id: contractId } })).status, 'INACTIVE');
    assert.equal((await request('/api/admin/management', 'DELETE', { entity: 'vehicle', id: vehicleId }, ctx.cookie)).status, 200);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'vehicle', id: vehicleId, data: { name: `${ctx.prefix}-edited` } }, ctx.cookie)).status, 200);
    assert.equal((await ctx.prisma.vehicle.findUnique({ where: { id: vehicleId } })).active, false);
    assert.equal((await request('/api/admin/management', 'POST', contractBody, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'contract', id: contractId, data: { status: 'ACTIVE' } }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/management', 'POST', { entity: 'setting', data: { key: 'heroBackground', value: 'http://example.invalid/image.jpg' } }, ctx.cookie)).status, 400);
    const listing = await request('/api/admin/management', 'GET', undefined, ctx.cookie);
    assert.equal(listing.status, 200);
    assert.ok(listing.data.contracts.some((item) => item.id === contractId && item.vehicleId === vehicleId));
    assert.ok(listing.data.pricing.some((item) => item.id === fareId && item.tripType === 'HOTEL_TRANSFER'));
    assert.ok(await ctx.prisma.auditLog.findFirst({ where: { entityId: contractId, action: 'ARCHIVE' } }));
  } finally { await ctx.cleanup(); }
});
