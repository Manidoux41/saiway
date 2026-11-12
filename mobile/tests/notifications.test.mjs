import assert from 'node:assert/strict';
import test from 'node:test';
import { notificationDestination } from '../src/lib/notification-policy.ts';

test('notifications open a validated trip only for their intended signed-in user', () => {
  assert.equal(notificationDestination({ recipientId: 'user1', bookingId: 'booking_123-abc' }, 'user1'), '/trip/booking_123-abc');
  assert.equal(notificationDestination({ recipientId: 'user1' }, 'user1'), '/trips');
  assert.equal(notificationDestination({ recipientId: 'previous-user', bookingId: 'booking123' }, 'user1'), null);
});

test('notification taps reject untrusted links, malformed ids and old unscoped payloads', () => {
  for (const value of [
    null, {}, { bookingId: '123' }, { recipientId: 'user1', bookingId: '../../admin' },
    { recipientId: 'user1', bookingId: 'https://attacker.invalid' },
    { recipientId: 'user1', bookingId: 'abc?redirect=//attacker.invalid' },
    { recipientId: 'user1', bookingId: 'x'.repeat(129) },
  ]) assert.equal(notificationDestination(value, 'user1'), null);
  assert.equal(notificationDestination({ recipientId: 'user1', url: 'https://attacker.invalid' }, 'user1'), '/trips');
});
