import test from 'node:test';
import { assert, request, setup, createAccount } from './helpers.mjs';
import { registerProfessional, approveProfessional, reviewInput, professionalBooking, professionalQuote } from './professional-helpers.mjs';

test('approved establishment books for a named guest at standard fares with separate hotel contact, own history, dispatch and immutable company snapshot', async () => {
  const ctx = await setup();
  try {
    const pro = await approveProfessional(ctx, await registerProfessional(ctx));
    const other = await approveProfessional(ctx, await registerProfessional(ctx, 'other'));
    const customer = await createAccount(ctx, 'CUSTOMER');
    const driver = await createAccount(ctx, 'DRIVER');
    const body = professionalBooking();
    const quote = await request(professionalQuote, 'GET', undefined, pro.cookie);
    const regularQuote = await request(professionalQuote, 'GET', undefined, customer.cookie);
    assert.equal(quote.status, 200);
    assert.equal(quote.data.priceCents, regularQuote.data.priceCents);
    const { passengerName, ...missing } = body;
    assert.equal((await request('/api/bookings', 'POST', missing, pro.cookie)).status, 400);
    assert.equal((await request('/api/bookings', 'POST', { ...body, passengerName: ' ' }, pro.cookie)).status, 400);
    for (const forged of [{ professionalCompany: 'Other company' }, { professionalPhone: '+85599999999' }, { customerId: other.profile.userId }, { priceCents: 1 }]) {
      assert.equal((await request('/api/bookings', 'POST', { ...body, ...forged }, pro.cookie)).status, 400);
    }
    const result = await request('/api/bookings', 'POST', body, pro.cookie);
    assert.equal(result.status, 201);
    const booking = result.data.booking;
    assert.equal(booking.originType, 'PROFESSIONAL');
    assert.equal(booking.customerId, pro.profile.userId);
    assert.equal(booking.passengerName, passengerName);
    assert.equal(booking.professionalCompany, pro.input.companyName);
    assert.equal(booking.professionalPhone, pro.input.contactPhone);
    assert.equal(booking.contactPhone, null);
    assert.equal(booking.priceCents, quote.data.priceCents);
    assert.equal(booking.paymentMethod, 'DRIVER');
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: booking.id } }), 0);
    const own = await request('/api/bookings', 'GET', undefined, pro.cookie);
    assert.ok(own.data.bookings.some(item => item.id === booking.id));
    assert.ok(!(await request('/api/bookings', 'GET', undefined, other.cookie)).data.bookings.some(item => item.id === booking.id));
    assert.equal((await request('/api/bookings', 'DELETE', { id: booking.id, status: 'CANCELLED' }, other.cookie)).status, 404);
    const profileId = pro.profile.id;
    const reviewed = await request(`/api/admin/professionals/${profileId}`, 'PATCH', reviewInput(pro.profile, { companyName: 'New hotel name', contactPhone: '+855 98 765 432', status: 'SUSPENDED' }), ctx.cookie);
    assert.equal(reviewed.status, 200);
    assert.equal((await request('/api/bookings', 'POST', body, pro.cookie)).status, 403);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(stored.professionalCompany, pro.input.companyName);
    assert.equal(stored.professionalPhone, pro.input.contactPhone);
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id: booking.id, driverId }, ctx.cookie)).status, 200);
    const driverView = (await request('/api/driver/bookings', 'GET', undefined, driver.cookie)).data.bookings.find(item => item.id === booking.id);
    assert.equal(driverView.passengerName, passengerName);
    assert.equal(driverView.professionalPhone, pro.input.contactPhone);
    const regular = await request('/api/bookings', 'POST', missing, customer.cookie);
    assert.equal(regular.status, 201);
    assert.equal(regular.data.booking.professionalCompany, null);
    assert.equal(regular.data.booking.originType, 'CUSTOMER');
    const invalidAdmin = await request('/api/admin/bookings', 'POST', { ...missing, customerId: other.profile.userId, priceCents: 3000, paymentMethod: undefined, contactPhone: undefined }, ctx.cookie);
    assert.equal(invalidAdmin.status, 400);
    assert.equal(invalidAdmin.data.error, 'PRO_PASSENGER_REQUIRED');
    assert.equal((await request('/api/admin/bookings', 'POST', { ...missing, passengerName, customerId: other.profile.userId, priceCents: 3000, paymentMethod: undefined, contactPhone: undefined }, ctx.cookie)).status, 201);
  } finally { await ctx.cleanup(); }
});
