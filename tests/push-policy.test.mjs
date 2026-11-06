import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedPushEndpoint, movingBetween, movementPushIntervalMs } from '../lib/push-policy.ts';

test('push endpoints allow only HTTPS browser providers, never arbitrary hosts or credentials', () => {
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/test', 'https://web.push.apple.com/test', 'https://updates.push.services.mozilla.com/wpush/v2/test', 'https://wns2.notify.windows.com/test']) assert.equal(allowedPushEndpoint(endpoint), true);
  for (const endpoint of ['http://fcm.googleapis.com/test', 'https://localhost/test', 'https://127.0.0.1/test', 'https://fcm.googleapis.com.attacker.invalid/test', 'https://user@fcm.googleapis.com/test', 'https://fcm.googleapis.com:444/test', 'file:///tmp/test']) assert.equal(allowedPushEndpoint(endpoint), false);
});

test('movement requires reliable GPS, at least 50 metres and a one-minute minimum interval', () => {
  const point = { latitude: 13.36, longitude: 103.85, accuracy: 5 };
  assert.equal(movementPushIntervalMs, 60_000);
  assert.equal(movingBetween(point, point), false);
  assert.equal(movingBetween(point, { ...point, latitude: point.latitude + 0.0001 }), false);
  assert.equal(movingBetween(point, { ...point, latitude: point.latitude + 0.001 }), true);
  assert.equal(movingBetween(point, { ...point, latitude: point.latitude + 0.001, accuracy: 100 }), false);
  assert.equal(movingBetween(point, { ...point, latitude: point.latitude + 0.001, accuracy: null }), false);
});
