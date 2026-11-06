import { test } from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';

test('pickup GPS persists in existing bookings and previous places stay isolated by customer', async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, 'CUSTOMER', 'location-owner');
    const other = await createAccount(ctx, 'CUSTOMER', 'location-other');
    const body = {
      fromAddress: 'GPS: 13.3612345, 103.8567891', toAddress: `${ctx.prefix} Phnom Penh`,
      direction: 'AIRPORT_TO_CITY', tripType: 'PRIVATE_TRANSFER',
      pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 2,
    };
    assert.equal((await request('/api/bookings/places')).status, 403);
    assert.equal((await request('/api/bookings/places', 'GET', undefined, ctx.cookie)).status, 403);
    for (const fromAddress of ['GPS: 91, 0', 'GPS: 0, 181', 'GPS: invalid']) {
      assert.equal((await request('/api/bookings', 'POST', { ...body, fromAddress }, customer.cookie)).status, 400);
    }
    const created = await request('/api/bookings', 'POST', body, customer.cookie);
    assert.equal(created.status, 201);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: created.data.booking.id } });
    assert.equal(stored.fromAddress, body.fromAddress);
    assert.equal(stored.toAddress, body.toAddress);
    const listing = await request('/api/bookings/places', 'GET', undefined, customer.cookie);
    assert.equal(listing.status, 200);
    assert.ok(listing.data.places.includes(body.fromAddress));
    assert.ok(listing.data.places.includes(body.toAddress));
    const foreign = await request('/api/bookings/places', 'GET', undefined, other.cookie);
    assert.equal(foreign.status, 200);
    assert.ok(!foreign.data.places.includes(body.toAddress));
    assert.ok(!foreign.data.places.includes(body.fromAddress));
  } finally { await ctx.cleanup(); }
});
