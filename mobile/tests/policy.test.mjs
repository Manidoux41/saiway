import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { canCancel, canPayOnline, cents, integer, nextStatus, paid, paymentLocked, pickupIso, trustedCheckout, visibleBookings } from '../src/lib/policy.ts';

const booking = (overrides = {}) => ({
  id: 'b1', reference: 'SW-TEST', fromAddress: 'SAI Airport', toAddress: 'Hotel',
  pickupAt: '2099-12-10T07:30:00Z', status: 'DRIVER_ASSIGNED', tripType: 'AIRPORT_TRANSFER',
  payments: [], ...overrides,
});

test('driver completes every valid transition without arbitrary status jumps', () => {
  let status = 'DRIVER_ASSIGNED';
  const journey = [];
  while (nextStatus[status]) { status = nextStatus[status]; journey.push(status); }
  assert.deepEqual(journey, ['DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED', 'TRIP_COMPLETED']);
  assert.equal(nextStatus.CANCELLED, undefined);
});

test('customer cancellation and online payment restrictions match server behavior', () => {
  assert.equal(canCancel(booking()), true);
  assert.equal(canCancel(booking({ status: 'DRIVER_ACCEPTED' })), false);
  assert.equal(canPayOnline(booking()), true);
  for (const overrides of [
    { tripType: 'TOURIST_TOUR' }, { metered: true }, { status: 'TRIP_STARTED' },
    { status: 'CANCELLED' }, { status: 'TRIP_COMPLETED' }, { pickupAt: '2000-01-01T00:00:00Z' },
    { payments: [{ status: 'PAID' }] },
  ]) assert.equal(canPayOnline(booking(overrides)), false);
  assert.equal(paymentLocked(booking({ payments: [{ status: 'PROCESSING' }] })), true);
  assert.equal(paid(booking({ payments: [{ status: 'PROCESSING' }] })), false);
});

test('pickup time is Cambodia local time regardless of device timezone and validates dates', () => {
  assert.equal(pickupIso('2099-12-10', '14:30'), '2099-12-10T07:30:00.000Z');
  for (const [date, time] of [['2099-02-31', '14:30'], ['2099-12-10', '24:00'], ['2099-12-10', '12:99'], ['2000-01-01', '00:00']]) {
    assert.throws(() => pickupIso(date, time));
  }
});

test('only approved HTTPS PayWay checkout origins can be opened', () => {
  assert.equal(trustedCheckout('https://checkout.payway.com.kh/pay?id=123'), 'https://checkout.payway.com.kh/pay?id=123');
  assert.doesNotThrow(() => trustedCheckout('https://checkout-sandbox.payway.com.kh/pay'));
  for (const value of ['http://checkout.payway.com.kh/pay', 'https://checkout.payway.com.kh.evil.test/pay', 'javascript:alert(1)', 'https://user@checkout.payway.com.kh/pay', 'https://checkout.payway.com.kh:444/pay']) {
    assert.throws(() => trustedCheckout(value));
  }
});

test('history, unpaid search and Cambodia-day filters use authoritative booking state', () => {
  const bookings = [
    booking({ id: 'done', status: 'TRIP_COMPLETED', pickupAt: '2026-01-01T00:00:00Z' }),
    booking({ id: 'unpaid', pickupAt: '2026-12-10T18:00:00Z' }),
    booking({ id: 'paid', pickupAt: '2026-12-10T19:00:00Z', payments: [{ status: 'PAID' }] }),
    booking({ id: 'cancelled', status: 'CANCELLED' }),
  ];
  assert.deepEqual(visibleBookings(bookings, 'payment', '').map(item => item.id), ['unpaid', 'done']);
  assert.deepEqual(visibleBookings(bookings, 'today', 'airport', new Date('2026-12-11T00:00:00Z')).map(item => item.id), ['unpaid', 'paid']);
  assert.deepEqual(visibleBookings(bookings, 'history', '').map(item => item.id), ['cancelled', 'done']);
});

test('amounts and counts reject invalid numbers instead of silently coercing', () => {
  assert.equal(cents('12,34'), 1234);
  assert.equal(integer('2', 1, 50, 'Passagers'), 2);
  for (const value of ['NaN', '-1', '1.234', '', '1e5']) assert.throws(() => cents(value));
  for (const value of ['', '1.5', '0', '51']) assert.throws(() => integer(value, 1, 50, 'Passagers'));
});
