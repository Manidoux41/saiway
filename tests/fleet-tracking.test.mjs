import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('one GPS stream feeds the admin fleet and only its own customer booking', async () => {
  const ctx = await setup();
  try {
    const customers = await Promise.all([
      createAccount(ctx, 'CUSTOMER', 'fleet-customer-a'),
      createAccount(ctx, 'CUSTOMER', 'fleet-customer-b'),
    ]);
    const drivers = await Promise.all([
      createAccount(ctx, 'DRIVER', 'fleet-driver-a'),
      createAccount(ctx, 'DRIVER', 'fleet-driver-b'),
    ]);
    const hub = await request('/api/admin/management', 'POST', {
      entity: 'hub',
      data: { name: `${ctx.prefix}-hub`, address: null, latitude: 13.36, longitude: 103.86 },
    }, ctx.cookie);
    assert.equal(hub.status, 201);

    const vehicles = await Promise.all(['TUK_TUK', 'VAN'].map((iconCategory, index) => request('/api/admin/management', 'POST', {
      entity: 'vehicle',
      data: { name: `${ctx.prefix}-vehicle-${index}`, plate: `${ctx.prefix}-${index}`, seats: 4, iconCategory },
    }, ctx.cookie)));
    assert.ok(vehicles.every((response) => response.status === 201));

    const bookings = await Promise.all(customers.map((customer, index) => request('/api/bookings', 'POST', {
      fromAddress: 'SAI Airport', toAddress: `Fleet test hotel ${index}`, direction: 'AIRPORT_TO_CITY',
      tripType: 'PRIVATE_TRANSFER', pickupAt: new Date(Date.now() + 3_600_000).toISOString(),
      passengers: 1, paymentMethod: 'DRIVER',
    }, customer.cookie)));
    assert.ok(bookings.every((response) => response.status === 201), JSON.stringify(bookings.map(({ status, data }) => ({ status, error: data.error }))));

    const driverProfiles = await Promise.all(drivers.map((driver) => ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })));
    await Promise.all(bookings.map((response, index) => ctx.prisma.booking.update({
      where: { id: response.data.booking.id },
      data: { driverId: driverProfiles[index].id, vehicleId: vehicles[index].data.item.id, status: 'DRIVER_EN_ROUTE' },
    })));

    const points = [
      { latitude: 13.3612, longitude: 103.8601, accuracy: 10, heading: 90 },
      { latitude: 13.3622, longitude: 103.8611, accuracy: 12, heading: 180 },
    ];
    const shares = await Promise.all(drivers.map((driver, index) => request('/api/driver/location', 'PUT', points[index], driver.cookie)));
    assert.ok(shares.every((response) => response.status === 200 && response.data.accepted));

    const fleet = await request('/api/admin/fleet-locations', 'GET', undefined, ctx.cookie);
    assert.equal(fleet.status, 200);
    assert.equal(fleet.data.hubs[0].id, hub.data.item.id);
    for (let index = 0; index < drivers.length; index += 1) {
      const activeDriver = fleet.data.drivers.find((driver) => driver.id === driverProfiles[index].id);
      assert.equal(activeDriver.status, 'TO_PICKUP');
      assert.equal(activeDriver.vehicle.iconCategory, index === 0 ? 'TUK_TUK' : 'VAN');
      assert.equal(activeDriver.location.heading, points[index].heading);
      assert.equal(activeDriver.target.address, 'SAI Airport');

      const own = await request(`/api/bookings/${bookings[index].data.booking.id}/location`, 'GET', undefined, customers[index].cookie);
      assert.equal(own.status, 200);
      assert.equal(own.data.location.heading, points[index].heading);
      assert.equal(own.data.tracking, true);
    }

    const crossBooking = await request(`/api/bookings/${bookings[0].data.booking.id}/location`, 'GET', undefined, customers[1].cookie);
    assert.equal(crossBooking.status, 404);
    assert.equal((await request('/api/admin/fleet-locations')).status, 403);
    assert.equal((await request('/api/driver/location', 'PUT', points[0], ctx.cookie)).status, 403);

    for (const status of ['DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED']) {
      const progress = await request('/api/driver/bookings', 'PATCH', { id: bookings[0].data.booking.id, status }, drivers[0].cookie);
      assert.equal(progress.status, 200);
    }
    const returningFleet = await request('/api/admin/fleet-locations', 'GET', undefined, ctx.cookie);
    const returningDriver = returningFleet.data.drivers.find((driver) => driver.id === driverProfiles[0].id);
    assert.equal(returningDriver.status, 'RETURNING_TO_HUB');
    assert.equal(returningDriver.target.hub.id, hub.data.item.id);
    assert.equal(returningDriver.vehicle.iconCategory, 'TUK_TUK');
    const driverState = await request('/api/driver/location', 'GET', undefined, drivers[0].cookie);
    assert.equal(driverState.data.vehicle.iconCategory, 'TUK_TUK');
    const closedTrip = await request(`/api/bookings/${bookings[0].data.booking.id}/location`, 'GET', undefined, customers[0].cookie);
    assert.equal(closedTrip.data.tracking, false);
    assert.equal(closedTrip.data.location, null);
  } finally { await ctx.cleanup(); }
});
