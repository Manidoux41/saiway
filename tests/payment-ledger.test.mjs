import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('driver declares unpaid then confirms actual method; manual ABA and PayWay receipts reach admin ledger once', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER');
    const driver = await createAccount(ctx, 'DRIVER');
    const otherDriver = await createAccount(ctx, 'DRIVER', 'other');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    const body = { fromAddress: 'SAI Airport', toAddress: 'Validation receipt hotel', direction: 'AIRPORT_TO_CITY', tripType: 'PRIVATE_TRANSFER', pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 2 };
    const ids = [];
    for (const method of ['CASH', 'CARD', 'ABA', 'OTHER', 'MANUAL_ABA']) {
      const created = await request('/api/bookings', 'POST', { ...body, paymentMethod: method === 'MANUAL_ABA' ? 'ONLINE' : 'DRIVER' }, customer.cookie);
      assert.equal(created.status, 201);
      const booking = created.data.booking;
      ids.push(booking.id);
      assert.equal(booking.payments.length, 0);
      await ctx.prisma.booking.update({ where: { id: booking.id }, data: { driverId, status: 'TRIP_COMPLETED' } });
      const receipt = { bookingId: booking.id, received: true, collectionMethod: method === 'MANUAL_ABA' ? 'ABA' : method };
      assert.equal((await request('/api/driver/payments', 'POST', receipt, otherDriver.cookie)).status, 404);
      assert.equal((await request('/api/driver/payments', 'POST', receipt, customer.cookie)).status, 403);
      const unpaid = await request('/api/driver/payments', 'POST', { bookingId: booking.id, received: false }, driver.cookie);
      assert.equal(unpaid.status, 200);
      assert.equal(unpaid.data.booking.payments.length, 0);
      assert.ok(await ctx.prisma.auditLog.findFirst({ where: { entityId: booking.id, action: 'DRIVER_PAYMENT_NOT_RECEIVED', actorId: driver.id } }));
      if (method === 'MANUAL_ABA') assert.equal((await request('/api/driver/payments', 'POST', { ...receipt, collectionMethod: 'CASH' }, driver.cookie)).status, 409);
      const confirmed = await request('/api/driver/payments', 'POST', receipt, driver.cookie);
      assert.equal(confirmed.status, 200);
      assert.equal(confirmed.data.booking.payments[0].collectionMethod, receipt.collectionMethod);
      assert.equal(confirmed.data.booking.payments[0].provider, method === 'MANUAL_ABA' ? 'ABA_QR_MANUAL' : 'DRIVER_DIRECT');
      assert.equal((await request('/api/driver/payments', 'POST', receipt, driver.cookie)).status, 200);
      assert.equal(await ctx.prisma.payment.count({ where: { bookingId: booking.id, status: 'PAID' } }), 1);
    }
    const extra = await request('/api/bookings', 'POST', { ...body, paymentMethod: 'ONLINE' }, customer.cookie);
    const extraId = extra.data.booking.id;
    await ctx.prisma.booking.update({ where: { id: extraId }, data: { driverId, status: 'TRIP_COMPLETED' } });
    await ctx.prisma.payment.create({ data: { bookingId: extraId, provider: 'ABA_PAYWAY', status: 'PROCESSING', amountCents: 3517, currency: 'USD' } });
    assert.equal((await request('/api/driver/payments', 'POST', { bookingId: extraId, received: true, collectionMethod: 'ABA' }, driver.cookie)).status, 409);
    await ctx.prisma.payment.updateMany({ where: { bookingId: extraId }, data: { status: 'PAID' } });
    await ctx.prisma.payment.create({ data: { bookingId: extraId, provider: 'ABA_PAYWAY_SANDBOX', status: 'PAID', amountCents: 99999, currency: 'USD' } });
    assert.equal((await request('/api/admin/management', 'GET', undefined, customer.cookie)).status, 403);
    const ledger = await request('/api/admin/management', 'GET', undefined, ctx.cookie);
    assert.equal(ledger.status, 200);
    const references = (await ctx.prisma.booking.findMany({ where: { id: { in: [...ids, extraId] } }, select: { reference: true } })).map((item) => item.reference);
    const receipts = ledger.data.receipts.filter((item) => references.includes(item.booking.reference));
    assert.equal(receipts.length, 6);
    assert.equal(receipts.reduce((sum, item) => sum + item.amountCents, 0), (await ctx.prisma.payment.aggregate({ where: { bookingId: { in: ids }, status: 'PAID' }, _sum: { amountCents: true } }))._sum.amountCents + 3517);
    assert.equal(receipts.filter((item) => item.provider === 'ABA_PAYWAY_SANDBOX').length, 0);
    assert.ok(receipts.every((item) => item.booking.driver.user.name.includes(ctx.prefix)));
    assert.equal((await request('/api/bookings', 'POST', { ...body, paymentMethod: 'FREE' }, customer.cookie)).status, 400);
  } finally { await ctx.cleanup(); }
});
