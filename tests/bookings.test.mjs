import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('customer reservation, administrator dispatch and driver progression persist with ownership boundaries', async () => {
  const ctx = await setup();
  let vehicleId;
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const otherCustomer = await createAccount(ctx, 'CUSTOMER', 'other-customer');
    const driver = await createAccount(ctx, 'DRIVER');
    const otherDriver = await createAccount(ctx, 'DRIVER', 'other-driver');
    const driverId = (await ctx.prisma.driverProfile.findUnique({ where: { userId: driver.id } })).id;
    const otherDriverId = (await ctx.prisma.driverProfile.findUnique({ where: { userId: otherDriver.id } })).id;
    const vehicle = await request('/api/admin/management', 'POST', { entity: 'vehicle', data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } }, ctx.cookie);
    assert.equal(vehicle.status, 201); vehicleId = vehicle.data.item.id;
    const body = { fromAddress: 'SAI Airport', toAddress: 'Validation hotel', direction: 'AIRPORT_TO_CITY', tripType: 'PRIVATE_TRANSFER', pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 2, luggageCount: 1, flightNumber: 'TEST123', pickupNotes: 'Keep this note' };
    const quotePath = '/api/bookings/quote?direction=AIRPORT_TO_CITY&tripType=PRIVATE_TRANSFER';
    assert.equal((await request(quotePath)).status, 403);
    assert.equal((await request(quotePath, 'GET', undefined, driver.cookie)).status, 403);
    const quote = await request(quotePath, 'GET', undefined, customer.cookie);
    assert.equal(quote.status, 200);
    assert.equal((await request('/api/bookings', 'POST', body)).status, 403);
    assert.equal((await request('/api/bookings', 'POST', body, driver.cookie)).status, 403);
    assert.equal((await request('/api/bookings', 'POST', body, ctx.cookie)).status, 403);
    for (const forged of [{ customerId: otherCustomer.id }, { priceCents: 1 }, { driverId }, { status: 'TRIP_COMPLETED' }]) assert.equal((await request('/api/bookings', 'POST', { ...body, ...forged }, customer.cookie)).status, 400);
    assert.equal((await request('/api/bookings', 'POST', { ...body, pickupAt: '2000-01-01T00:00:00Z' }, customer.cookie)).status, 400);
    const created = await request('/api/bookings', 'POST', body, customer.cookie);
    assert.equal(created.status, 201);
    const id = created.data.booking.id;
    assert.equal(created.data.booking.customerId, customer.id);
    assert.equal(created.data.booking.priceCents, quote.data.priceCents);
    assert.equal((await ctx.prisma.booking.findUnique({ where: { id } })).flightNumber, 'TEST123');
    assert.ok((await request('/api/bookings', 'GET', undefined, customer.cookie)).data.bookings.some((item) => item.id === id));
    assert.ok(!(await request('/api/bookings', 'GET', undefined, otherCustomer.cookie)).data.bookings.some((item) => item.id === id));
    assert.equal((await request('/api/bookings', 'DELETE', { id, status: 'CANCELLED' }, otherCustomer.cookie)).status, 404);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, status: 'TRIP_COMPLETED' }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, status: 'CONFIRMED', priceCents: 1 }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, status: 'CONFIRMED' }, driver.cookie)).status, 403);
    assert.ok((await request('/api/admin/bookings', 'GET', undefined, ctx.cookie)).data.bookings.some((item) => item.id === id));
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: id } }), 0);
    assert.equal((await request('/api/payments/payway/checkout', 'POST', { bookingId: id }, otherCustomer.cookie)).status, 404);
    assert.equal((await request('/api/payments/payway/checkout', 'POST', { bookingId: id }, driver.cookie)).status, 403);
    assert.equal((await request('/api/payments/payway/checkout', 'POST', { bookingId: id, amountCents: 1 }, customer.cookie)).status, 400);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, priceCents: 4200 }, ctx.cookie)).status, 200);
    await ctx.prisma.payment.create({ data: { bookingId: id, provider: 'TEST_FIXTURE', status: 'PAID', amountCents: 4200, currency: 'USD' } });
    assert.ok((await request('/api/admin/bookings', 'GET', undefined, ctx.cookie)).data.bookings.some((item) => item.id === id));
    const confirmed = await request('/api/admin/bookings', 'PATCH', { id, status: 'CONFIRMED' }, ctx.cookie);
    assert.equal(confirmed.status, 200);
    assert.equal(confirmed.data.booking.status, 'CONFIRMED');
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, status: 'CONFIRMED' }, ctx.cookie)).status, 409);
    assert.equal((await ctx.prisma.booking.findUnique({ where: { id } })).status, 'CONFIRMED');
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: id } }), 1);
    assert.ok(await ctx.prisma.auditLog.findFirst({ where: { entityId: id, action: 'CONFIRM' } }));
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, driverId, vehicleId, passengers: 5 }, ctx.cookie)).status, 400);
    await ctx.prisma.user.update({ where: { id: otherDriver.id }, data: { status: 'SUSPENDED' } });
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, driverId: otherDriverId }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, driverId, vehicleId, priceCents: 1 }, ctx.cookie)).status, 409);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, driverId, vehicleId }, ctx.cookie)).status, 200);
    assert.ok((await request('/api/driver/bookings', 'GET', undefined, driver.cookie)).data.bookings.some((item) => item.id === id));
    const adminView = (await request('/api/admin/bookings', 'GET', undefined, ctx.cookie)).data.bookings.find((item) => item.id === id);
    const driverView = (await request('/api/driver/bookings', 'GET', undefined, driver.cookie)).data.bookings.find((item) => item.id === id);
    assert.deepEqual(driverView, adminView);
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, status: 'CONFIRMED' }, ctx.cookie)).status, 409);
    await ctx.prisma.user.update({ where: { id: otherDriver.id }, data: { status: 'ACTIVE' } });
    assert.ok(!(await request('/api/driver/bookings', 'GET', undefined, otherDriver.cookie)).data.bookings.some((item) => item.id === id));
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status: 'DRIVER_ACCEPTED' }, otherDriver.cookie)).status, 404);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status: 'TRIP_COMPLETED' }, driver.cookie)).status, 403);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status: 'DRIVER_ACCEPTED', priceCents: 1 }, driver.cookie)).status, 400);
    const accepted = await Promise.all([1, 2].map(() => request('/api/driver/bookings', 'PATCH', { id, status: 'DRIVER_ACCEPTED' }, driver.cookie)));
    assert.equal(accepted.filter((result) => result.status === 200).length, 1);
    assert.ok(accepted.some((result) => [403, 409].includes(result.status)));
    let edited = await request('/api/admin/bookings', 'PATCH', { id, driverId, vehicleId, toAddress: 'Updated hotel' }, ctx.cookie);
    assert.equal(edited.status, 200);
    assert.equal(edited.data.booking.status, 'DRIVER_ACCEPTED');
    assert.equal(edited.data.booking.pickupNotes, 'Keep this note');
    const updatedDriverView = (await request('/api/driver/bookings', 'GET', undefined, driver.cookie)).data.bookings.find((item) => item.id === id);
    assert.equal(updatedDriverView.toAddress, 'Updated hotel');
    assert.equal(updatedDriverView.status, 'DRIVER_ACCEPTED');
    assert.equal((await request('/api/bookings', 'DELETE', { id, status: 'CANCELLED' }, customer.cookie)).status, 409);
    for (const status of ['DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED']) {
      if (status === 'TRIP_STARTED') {
        edited = await request('/api/admin/bookings', 'PATCH', { id, driverId, vehicleId, pickupNotes: 'Updated operational note' }, ctx.cookie);
        assert.equal(edited.status, 200);
        assert.equal(edited.data.booking.status, 'DRIVER_ARRIVED');
        assert.equal((await request('/api/admin/bookings', 'PATCH', { id, driverId: otherDriverId }, ctx.cookie)).status, 409);
      }
      assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status }, driver.cookie)).status, 200);
    }
    const stored = await ctx.prisma.booking.findUnique({ where: { id }, include: { statusHistory: true, payments: true } });
    assert.equal(stored.status, 'TRIP_COMPLETED'); assert.equal(stored.priceCents, 4200);
    assert.equal(stored.payments.length, 1);
    assert.deepEqual(stored.statusHistory.map((entry) => entry.status).filter((status, index, all) => index === 0 || status !== all[index - 1]), ['PENDING_PAYMENT', 'CONFIRMED', 'DRIVER_ASSIGNED', 'DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED']);
    assert.equal((await request('/api/admin/bookings', 'DELETE', { id, status: 'CANCELLED' }, ctx.cookie)).status, 409);
    const adminCreated = await request('/api/admin/bookings', 'POST', { ...body, customerId: customer.id, driverId, vehicleId, priceCents: 5000 }, ctx.cookie);
    assert.equal(adminCreated.status, 201); assert.equal(adminCreated.data.booking.status, 'DRIVER_ASSIGNED');
    assert.ok((await request('/api/driver/bookings', 'GET', undefined, driver.cookie)).data.bookings.some((item) => item.id === adminCreated.data.booking.id));
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: adminCreated.data.booking.id } }), 0);
    const secondId = adminCreated.data.booking.id;
    assert.equal((await request('/api/admin/bookings', 'DELETE', { id: secondId, status: 'CANCELLED' }, ctx.cookie)).status, 200);
    const cancelled = await ctx.prisma.booking.findUnique({ where: { id: secondId }, include: { statusHistory: true } });
    assert.equal(cancelled.status, 'CANCELLED'); assert.equal(cancelled.statusHistory.length, 2);
    assert.ok(await ctx.prisma.auditLog.findFirst({ where: { entityId: secondId, action: 'CANCEL' } }));
    await request('/api/admin/management', 'DELETE', { entity: 'vehicle', id: vehicleId }, ctx.cookie);
    assert.equal((await request('/api/admin/bookings', 'POST', { ...body, customerId: customer.id, vehicleId, priceCents: 5000 }, ctx.cookie)).status, 400);
    const selfCancelled = await request('/api/bookings', 'POST', body, customer.cookie);
    assert.equal(selfCancelled.status, 201);
    assert.equal((await request('/api/bookings', 'DELETE', { id: selfCancelled.data.booking.id, status: 'CANCELLED' }, customer.cookie)).status, 200);
  } finally { await ctx.cleanup(); }
});

test('dispatch precedes payment choice and only the assigned driver collects after completion', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const otherCustomer = await createAccount(ctx, 'CUSTOMER', 'other-customer');
    const driver = await createAccount(ctx, 'DRIVER');
    const otherDriver = await createAccount(ctx, 'DRIVER', 'other-driver');
    const driverId = (await ctx.prisma.driverProfile.findUnique({ where: { userId: driver.id } })).id;
    const body = { fromAddress: 'SAI Airport', toAddress: 'Validation pay-at-driver hotel', direction: 'AIRPORT_TO_CITY', tripType: 'AIRPORT_TRANSFER', pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 2 };
    const created = await request('/api/bookings', 'POST', body, customer.cookie);
    assert.equal(created.status, 201);
    const id = created.data.booking.id;
    assert.equal(created.data.booking.paymentMethod, 'UNDECIDED');
    assert.ok((await request('/api/admin/bookings', 'GET', undefined, ctx.cookie)).data.bookings.some((item) => item.id === id));
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, driverId }, ctx.cookie)).status, 200);
    const assigned = (await request('/api/driver/bookings', 'GET', undefined, driver.cookie)).data.bookings.find((item) => item.id === id);
    assert.equal(assigned.paymentMethod, 'UNDECIDED');
    assert.equal(assigned.payments.length, 0);

    const choose = { bookingId: id, paymentMethod: 'DRIVER' };
    assert.equal((await request('/api/bookings/payment-method', 'POST', choose, otherCustomer.cookie)).status, 404);
    assert.equal((await request('/api/bookings/payment-method', 'POST', choose, driver.cookie)).status, 403);
    assert.equal((await request('/api/bookings/payment-method', 'POST', { ...choose, amountCents: 1 }, customer.cookie)).status, 400);
    const chosen = await request('/api/bookings/payment-method', 'POST', choose, customer.cookie);
    assert.equal(chosen.status, 200);
    assert.equal(chosen.data.booking.paymentMethod, 'DRIVER');
    assert.equal(chosen.data.booking.status, 'DRIVER_ASSIGNED');
    assert.equal(chosen.data.booking.payments.length, 0);
    assert.equal((await request('/api/payments/payway/checkout', 'POST', { bookingId: id }, customer.cookie)).status, 409);

    const received = { bookingId: id, received: true };
    assert.equal((await request('/api/driver/payments', 'POST', received)).status, 403);
    assert.equal((await request('/api/driver/payments', 'POST', received, customer.cookie)).status, 403);
    assert.equal((await request('/api/driver/payments', 'POST', received, ctx.cookie)).status, 403);
    assert.equal((await request('/api/driver/payments', 'POST', received, otherDriver.cookie)).status, 404);
    assert.equal((await request('/api/driver/payments', 'POST', received, driver.cookie)).status, 409);
    assert.equal((await request('/api/driver/payments', 'POST', { ...received, amountCents: 1 }, driver.cookie)).status, 400);
    assert.equal((await request('/api/driver/payments', 'POST', { ...received, received: false }, driver.cookie)).status, 400);
    for (const status of ['DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED']) {
      assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status }, driver.cookie)).status, 200);
    }
    assert.equal((await request('/api/driver/payments', 'POST', received, driver.cookie)).status, 409);
    assert.equal((await request('/api/driver/bookings', 'PATCH', { id, status: 'TRIP_COMPLETED' }, driver.cookie)).status, 200);
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: id } }), 0);
    const collected = await Promise.all([1, 2].map(() => request('/api/driver/payments', 'POST', received, driver.cookie)));
    assert.ok(collected.some((result) => result.status === 200));
    assert.ok(collected.every((result) => [200, 409].includes(result.status)));
    assert.equal((await request('/api/driver/payments', 'POST', received, driver.cookie)).status, 200);
    const payments = await ctx.prisma.payment.findMany({ where: { bookingId: id } });
    assert.equal(payments.length, 1);
    assert.equal(payments[0].status, 'PAID');
    assert.equal(payments[0].provider, 'DRIVER_DIRECT');
    assert.equal(payments[0].amountCents, assigned.priceCents);
    assert.equal(payments[0].currency, assigned.currency);
    const audits = await ctx.prisma.auditLog.findMany({ where: { entityId: id, action: 'DRIVER_PAYMENT_CONFIRMED' } });
    assert.equal(audits.length, 1);
    assert.equal(audits[0].actorId, driver.id);
    assert.equal((await request('/api/bookings/payment-method', 'POST', { bookingId: id, paymentMethod: 'ONLINE' }, customer.cookie)).status, 409);
    const adminView = (await request('/api/admin/bookings', 'GET', undefined, ctx.cookie)).data.bookings.find((item) => item.id === id);
    const customerView = (await request('/api/bookings', 'GET', undefined, customer.cookie)).data.bookings.find((item) => item.id === id);
    assert.deepEqual(adminView, customerView);
    assert.equal(customerView.payments[0].status, 'PAID');

    const second = await request('/api/bookings', 'POST', body, customer.cookie);
    const secondId = second.data.booking.id;
    await ctx.prisma.payment.create({ data: { bookingId: secondId, provider: 'TEST_PROCESSING', status: 'PROCESSING', amountCents: second.data.booking.priceCents, currency: second.data.booking.currency } });
    assert.equal((await request('/api/bookings/payment-method', 'POST', { bookingId: secondId, paymentMethod: 'DRIVER' }, customer.cookie)).status, 409);
  } finally { await ctx.cleanup(); }
});
