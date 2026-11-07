import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

const reservation = (pickupAt = new Date(Date.now() + 86400000).toISOString(), passengers = 1) => ({
  fromAddress: 'GPS: 13.36, 103.85', toAddress: 'Validation hotel', direction: 'AIRPORT_TO_CITY',
  tripType: 'AIRPORT_TRANSFER', pickupAt, passengers, paymentMethod: 'DRIVER',
});
async function available(ctx, suffix, seats = 4, point = null) {
  const account = await createAccount(ctx, 'DRIVER', suffix);
  const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: account.id } });
  const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: `${ctx.prefix}-${suffix}`, seats } });
  assert.equal((await request('/api/driver/availability', 'PATCH', { isAvailable: true, selectedVehicleId: vehicle.id }, account.cookie)).status, 200);
  if (point) await ctx.prisma.driverLocation.create({ data: { driverId: profile.id, latitude: point.latitude, longitude: point.longitude, accuracy: point.accuracy ?? 5, recordedAt: point.recordedAt ?? new Date() } });
  return { ...account, profile, vehicle };
}

test('automatic dispatch chooses nearest compatible fresh GPS, preserves ownership and never confirms payment', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const otherCustomer = await createAccount(ctx, 'CUSTOMER', 'other');
    const far = await available(ctx, 'far', 4, { latitude: 13.38, longitude: 103.85 });
    const near = await available(ctx, 'near', 4, { latitude: 13.3601, longitude: 103.85 });
    await available(ctx, 'too-small', 1, { latitude: 13.36, longitude: 103.85 });
    const suspended = await available(ctx, 'suspended', 4, { latitude: 13.36, longitude: 103.85 });
    await ctx.prisma.user.update({ where: { id: suspended.id }, data: { status: 'SUSPENDED' } });
    const body = reservation(undefined, 2);
    assert.equal((await request('/api/bookings', 'POST', body)).status, 403);
    assert.equal((await request('/api/bookings', 'POST', body, near.cookie)).status, 403);
    const created = await request('/api/bookings', 'POST', body, customer.cookie);
    assert.equal(created.status, 201);
    assert.equal(created.data.booking.driverId, near.profile.id);
    assert.equal(created.data.booking.vehicleId, near.vehicle.id);
    assert.equal(created.data.booking.status, 'DRIVER_ASSIGNED');
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: created.data.booking.id } });
    assert.equal(stored.dispatchEndsAt.getTime() - stored.pickupAt.getTime(), 210 * 60_000);
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: stored.id } }), 0);
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({ where: { entityId: stored.id, action: 'AUTO_ASSIGN' } });
    assert.equal(audit.metadata.fallback, false);
    assert.ok(audit.metadata.distanceMeters < 20);
    assert.ok((await request('/api/driver/bookings', 'GET', undefined, near.cookie)).data.bookings.some(item => item.id === stored.id));
    assert.ok(!(await request('/api/driver/bookings', 'GET', undefined, far.cookie)).data.bookings.some(item => item.id === stored.id));
    assert.ok(!(await request('/api/bookings', 'GET', undefined, otherCustomer.cookie)).data.bookings.some(item => item.id === stored.id));
    assert.equal((await request('/api/bookings', 'DELETE', { id: stored.id, status: 'CANCELLED' }, customer.cookie)).status, 200);
  } finally { await ctx.cleanup(); }
});

test('stale or inaccurate GPS uses availability order; no compatible driver leaves manual dispatch and is not reassigned by a switch', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const oldest = await available(ctx, 'oldest', 4, { latitude: 13.36, longitude: 103.85, recordedAt: new Date(Date.now() - 121000) });
    const newest = await available(ctx, 'newest', 4, { latitude: 13.36, longitude: 103.85, accuracy: 100 });
    await ctx.prisma.driverProfile.update({ where: { id: oldest.profile.id }, data: { availableSince: new Date(Date.now() - 3600000) } });
    const created = await request('/api/bookings', 'POST', reservation(), customer.cookie);
    assert.equal(created.status, 201);
    assert.equal(created.data.booking.driverId, oldest.profile.id);
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({ where: { entityId: created.data.booking.id, action: 'AUTO_ASSIGN' } });
    assert.equal(audit.metadata.fallback, true);
    for (const driver of [oldest, newest]) assert.equal((await request('/api/driver/availability', 'PATCH', { isAvailable: false, selectedVehicleId: driver.vehicle.id }, driver.cookie)).status, 200);
    const waiting = await request('/api/bookings', 'POST', reservation(), customer.cookie);
    assert.equal(waiting.status, 201);
    assert.equal(waiting.data.booking.driverId, null);
    assert.equal((await request('/api/driver/availability', 'PATCH', { isAvailable: true, selectedVehicleId: newest.vehicle.id }, newest.cookie)).status, 200);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: waiting.data.booking.id } })).driverId, null);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id: waiting.data.booking.id, driverId: newest.profile.id, vehicleId: newest.vehicle.id }, ctx.cookie)).status, 200);
  } finally { await ctx.cleanup(); }
});

test('parallel reservations and manual rescheduling cannot double-book a driver or vehicle', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const driver = await available(ctx, 'driver');
    const pickupAt = new Date(Date.now() + 86400000);
    const results = await Promise.all([1, 2].map(() => request('/api/bookings', 'POST', reservation(pickupAt.toISOString()), customer.cookie)));
    assert.ok(results.every(item => item.status === 201));
    const assigned = results.filter(item => item.data.booking.driverId);
    assert.equal(assigned.length, 1);
    const pending = results.find(item => !item.data.booking.driverId).data.booking;
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id: pending.id, driverId: driver.profile.id, vehicleId: driver.vehicle.id }, ctx.cookie)).status, 409);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: pending.id } })).driverId, null);
    const afterBuffer = new Date(pickupAt.getTime() + 210 * 60_000);
    const next = await request('/api/bookings', 'POST', reservation(afterBuffer.toISOString()), customer.cookie);
    assert.equal(next.status, 201);
    assert.equal(next.data.booking.driverId, driver.profile.id, 'Touching half-open schedule intervals do not overlap');
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id: next.data.booking.id, pickupAt: new Date(afterBuffer.getTime() - 1).toISOString() }, ctx.cookie)).status, 409);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: next.data.booking.id } })).pickupAt.getTime(), afterBuffer.getTime());
    assert.equal((await request('/api/bookings', 'DELETE', { id: assigned[0].data.booking.id, status: 'CANCELLED' }, customer.cookie)).status, 200);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id: pending.id, driverId: driver.profile.id, vehicleId: driver.vehicle.id }, ctx.cookie)).status, 200);
  } finally { await ctx.cleanup(); }
});

test('in-service drivers receive only future non-overlapping reservations and tourist packages reserve their full duration', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const driver = await available(ctx, 'driver');
    const now = new Date();
    const current = await ctx.prisma.booking.create({ data: {
      ...reservation(now.toISOString()), pickupAt: now, reference: ctx.prefix, driverId: driver.profile.id, vehicleId: driver.vehicle.id,
      customerId: customer.id, priceCents: 3000, status: 'TRIP_STARTED', startedAt: now, dispatchEndsAt: new Date(now.getTime() + 3600000),
    } });
    const busy = await request('/api/bookings', 'POST', reservation(new Date(now.getTime() + 600000).toISOString()), customer.cookie);
    assert.equal(busy.status, 201);
    assert.equal(busy.data.booking.driverId, null);
    const futureTime = new Date(now.getTime() + 86400000);
    const future = await request('/api/bookings', 'POST', reservation(futureTime.toISOString()), customer.cookie);
    assert.equal(future.status, 201);
    assert.equal(future.data.booking.driverId, driver.profile.id);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id: future.data.booking.id, status: 'DRIVER_ACCEPTED' }, driver.cookie)).status, 200);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id: future.data.booking.id, status: 'DRIVER_EN_ROUTE' }, driver.cookie)).status, 409);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id: current.id, status: 'TRIP_COMPLETED' }, driver.cookie)).status, 200);
    const tourStart = new Date(futureTime.getTime() + 24 * 3600000);
    const tour = await request('/api/bookings', 'POST', { ...reservation(tourStart.toISOString()), tripType: 'TOURIST_TOUR', tourHours: 10, tourCircuit: 'SMALL' }, customer.cookie);
    assert.equal(tour.status, 201);
    assert.equal(tour.data.booking.driverId, driver.profile.id);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: tour.data.booking.id } });
    assert.equal(stored.dispatchEndsAt.getTime() - tourStart.getTime(), 10.5 * 3600000);
    const overlaps = await request('/api/bookings', 'POST', reservation(new Date(tourStart.getTime() + 9 * 3600000).toISOString()), customer.cookie);
    assert.equal(overlaps.status, 201);
    assert.equal(overlaps.data.booking.driverId, null);
  } finally { await ctx.cleanup(); }
});

test('city schedule uses the saved road duration and historical reservations block both drivers and vehicles', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const driver = await available(ctx, 'driver');
    const pickup = new Date(Date.now() + 86400000);
    const city = await request('/api/bookings', 'POST', { ...reservation(pickup.toISOString()), tripType: 'CITY_TRANSFER', toAddress: 'GPS: 13.37, 103.86' }, customer.cookie);
    assert.equal(city.status, 201);
    assert.equal(city.data.booking.driverId, driver.profile.id);
    assert.equal(city.data.booking.routeDetails.durationSeconds, 600);
    assert.equal(Date.parse(city.data.booking.dispatchEndsAt) - pickup.getTime(), 40 * 60_000);
    const legacyDriver = await createAccount(ctx, 'DRIVER', 'legacy');
    const legacyProfile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: legacyDriver.id } });
    const legacyStart = new Date(pickup.getTime() + 86400000);
    const legacy = await ctx.prisma.booking.create({ data: {
      ...reservation(legacyStart.toISOString()), pickupAt: legacyStart, reference: ctx.prefix, driverId: legacyProfile.id, vehicleId: driver.vehicle.id,
      priceCents: 3000, status: 'DRIVER_ASSIGNED', dispatchEndsAt: null,
    } });
    const overlapping = await request('/api/bookings', 'POST', reservation(new Date(legacyStart.getTime() + 60000).toISOString()), customer.cookie);
    assert.equal(overlapping.status, 201);
    assert.equal(overlapping.data.booking.driverId, null, 'Historical vehicle reservation excludes a different available driver');
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id: city.data.booking.id, pickupAt: legacyStart.toISOString() }, ctx.cookie)).status, 409);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: legacy.id } })).dispatchEndsAt, null, 'Historical data is read without destructive backfill');
  } finally { await ctx.cleanup(); }
});
