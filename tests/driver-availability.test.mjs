import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('driver availability is owned, persisted, idempotent, vehicle-validated and does not cancel assigned trips', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const other = await createAccount(ctx, 'DRIVER', 'other');
    const customer = await createAccount(ctx, 'CUSTOMER');
    const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } });
    const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } });
    const inactive = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: `${ctx.prefix}-inactive`, seats: 4, active: false } });
    const patch = (isAvailable, selectedVehicleId = vehicle.id, cookie = driver.cookie) => request('/api/driver/availability', 'PATCH', { isAvailable, selectedVehicleId }, cookie);
    assert.equal((await request('/api/driver/availability')).status, 403);
    assert.equal((await request('/api/driver/availability', 'GET', undefined, customer.cookie)).status, 403);
    assert.equal((await patch(true, vehicle.id, ctx.cookie)).status, 403);
    assert.equal((await request('/api/driver/availability', 'PATCH', { isAvailable: true, selectedVehicleId: vehicle.id, userId: other.id }, driver.cookie)).status, 400);
    assert.equal((await patch(true, null)).status, 422);
    assert.equal((await patch(true, inactive.id)).status, 422);
    assert.equal((await patch(false, 'missing')).status, 422);
    const disabled = await patch(false);
    assert.equal(disabled.status, 200);
    const enabled = await patch(true);
    assert.equal(enabled.status, 200);
    assert.equal(enabled.data.driverAvailability.selectedVehicleId, vehicle.id);
    assert.equal((await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { id: profile.id } })).isAvailable, true);
    const repeat = await patch(true);
    assert.equal(repeat.status, 200);
    assert.equal(repeat.data.driverAvailability.availableSince, enabled.data.driverAvailability.availableSince);
    assert.equal(await ctx.prisma.auditLog.count({ where: { entityId: profile.id, action: 'AVAILABILITY' } }), 2);
    assert.equal((await patch(true, vehicle.id, other.cookie)).status, 409);
    const state = await request('/api/driver/bookings', 'GET', undefined, driver.cookie);
    assert.equal(state.data.driverAvailability.selectedVehicleId, vehicle.id);
    const options = await request('/api/driver/availability', 'GET', undefined, driver.cookie);
    assert.ok(options.data.vehicles.some(item => item.id === vehicle.id));
    assert.ok(!options.data.vehicles.some(item => item.id === inactive.id));
    const booking = await ctx.prisma.booking.create({ data: {
      customerId: customer.id, driverId: profile.id, vehicleId: vehicle.id, reference: ctx.prefix,
      fromAddress: 'SAI Airport', toAddress: 'Validation hotel', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER',
      pickupAt: new Date(Date.now() + 86400000), priceCents: 3000, passengers: 1, status: 'DRIVER_ASSIGNED',
    } });
    assert.equal((await patch(false)).status, 200);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).driverId, profile.id);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id: booking.id, status: 'DRIVER_ACCEPTED' }, driver.cookie)).status, 200);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id: booking.id, status: 'DRIVER_EN_ROUTE' }, driver.cookie)).status, 200);
    assert.equal((await patch(false, null)).status, 409, 'Do not change the vehicle during service');
    assert.equal((await patch(true)).status, 200, 'Enable future non-overlapping assignments during service');
    const fleet = await request('/api/admin/fleet-locations', 'GET', undefined, ctx.cookie);
    assert.equal(fleet.data.drivers.find(item => item.id === profile.id).status, 'TO_PICKUP');
    for (const status of ['DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED']) assert.equal((await request('/api/driver/bookings', 'PATCH', { id: booking.id, status }, driver.cookie)).status, 200);
    assert.equal((await patch(false)).status, 200);
    const offFleet = await request('/api/admin/fleet-locations', 'GET', undefined, ctx.cookie);
    assert.equal(offFleet.data.drivers.find(item => item.id === profile.id).status, 'UNAVAILABLE');
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: booking.id } }), 0);
  } finally { await ctx.cleanup(); }
});

test('two drivers enabling the same vehicle concurrently cannot both become eligible', async () => {
  const ctx = await setup();
  try {
    const first = await createAccount(ctx, 'DRIVER', 'first');
    const second = await createAccount(ctx, 'DRIVER', 'second');
    const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } });
    const results = await Promise.all([first, second].map(driver => request('/api/driver/availability', 'PATCH', { isAvailable: true, selectedVehicleId: vehicle.id }, driver.cookie)));
    assert.equal(results.filter(item => item.status === 200).length, 1);
    assert.equal(results.filter(item => item.status === 409).length, 1);
    assert.equal(await ctx.prisma.driverProfile.count({ where: { selectedVehicleId: vehicle.id, isAvailable: true } }), 1);
  } finally { await ctx.cleanup(); }
});
