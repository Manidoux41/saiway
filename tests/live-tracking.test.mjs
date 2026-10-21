import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('driver shares live GPS only while the trip is under way and only authorised parties can read it', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const otherCustomer = await createAccount(ctx, 'CUSTOMER', 'other-customer');
    const driver = await createAccount(ctx, 'DRIVER');
    const otherDriver = await createAccount(ctx, 'DRIVER', 'other-driver');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    const created = await request('/api/bookings', 'POST', { fromAddress: 'SAI Airport', toAddress: 'Validation live hotel', direction: 'AIRPORT_TO_CITY', tripType: 'PRIVATE_TRANSFER', pickupAt: new Date(Date.now() + 3600000).toISOString(), passengers: 1, paymentMethod: 'DRIVER' }, customer.cookie);
    assert.equal(created.status, 201);
    const id = created.data.booking.id;
    await ctx.prisma.booking.update({ where: { id }, data: { driverId, status: 'DRIVER_ACCEPTED' } });
    const share = (body, cookie) => request(`/api/driver/bookings/${id}/location`, 'PUT', body, cookie);
    const read = (cookie) => request(`/api/bookings/${id}/location`, 'GET', undefined, cookie);
    const point = { latitude: 13.3612, longitude: 103.8601, accuracy: 12 };

    assert.equal((await share(point, driver.cookie)).status, 409, 'no sharing before the driver departs');
    const before = await read(customer.cookie);
    assert.equal(before.status, 200);
    assert.equal(before.data.tracking, false);
    assert.equal(before.data.location, null);

    assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status: 'DRIVER_EN_ROUTE' }, driver.cookie)).status, 200);
    assert.equal((await share({ latitude: 200, longitude: 103.86 }, driver.cookie)).status, 400);
    assert.equal((await share({ ...point, injected: true }, driver.cookie)).status, 400);
    assert.equal((await share(point, customer.cookie)).status, 403);
    assert.equal((await share(point)).status, 403);
    assert.equal((await share(point, otherDriver.cookie)).status, 404);

    const first = await share(point, driver.cookie);
    assert.equal(first.status, 200);
    assert.equal(first.data.accepted, true);
    assert.equal((await share({ ...point, latitude: 13.37 }, driver.cookie)).status, 202, 'bursts are throttled');

    const live = await read(customer.cookie);
    assert.equal(live.status, 200);
    assert.equal(live.data.tracking, true);
    assert.equal(live.data.booking.status, 'DRIVER_EN_ROUTE');
    assert.ok(live.data.booking.driverName.includes(ctx.prefix));
    assert.deepEqual([live.data.location.latitude, live.data.location.longitude, live.data.location.accuracy], [point.latitude, point.longitude, point.accuracy]);
    assert.equal((await read()).status, 401);
    assert.equal((await read(otherCustomer.cookie)).status, 404);
    assert.equal((await read(otherDriver.cookie)).status, 404);
    assert.equal((await read(ctx.cookie)).status, 200);
    assert.equal((await read(driver.cookie)).status, 200);

    await sleep(2100);
    const moved = { latitude: 13.3655, longitude: 103.8577, accuracy: null };
    assert.equal((await share(moved, driver.cookie)).status, 200);
    assert.equal(await ctx.prisma.driverLocation.count({ where: { bookingId: id } }), 1, 'only the latest point is stored');
    const updated = await read(customer.cookie);
    assert.deepEqual([updated.data.location.latitude, updated.data.location.longitude, updated.data.location.accuracy], [moved.latitude, moved.longitude, null]);

    for (const status of ['DRIVER_ARRIVED', 'TRIP_STARTED']) {
      assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status }, driver.cookie)).status, 200);
      const during = await read(customer.cookie);
      assert.equal(during.data.tracking, true);
      assert.ok(during.data.location);
    }
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status: 'TRIP_COMPLETED' }, driver.cookie)).status, 200);
    const after = await read(customer.cookie);
    assert.equal(after.data.tracking, false);
    assert.equal(after.data.location, null);
    assert.equal(await ctx.prisma.driverLocation.count({ where: { bookingId: id } }), 0, 'position is erased when the trip closes');
    assert.equal((await share(point, driver.cookie)).status, 409);
  } finally { await ctx.cleanup(); }
});
