import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { expoTokenSchema, nativeSubscriptionSchema, nativePushConfigured, sendNativePush, nativePushReceipts } from '../lib/native-push.ts';

const original = { enabled: process.env.NATIVE_PUSH_ENABLED, token: process.env.EXPO_PUSH_ACCESS_TOKEN };
after(() => {
  for (const [name, value] of [['NATIVE_PUSH_ENABLED', original.enabled], ['EXPO_PUSH_ACCESS_TOKEN', original.token]]) {
    if (value === undefined) delete process.env[name]; else process.env[name] = value;
  }
});
const token = 'ExpoPushToken[test-device_123]';
const message = { body: 'Your driver has arrived', recipientId: 'customer-123', eventKey: 'arrived:123', bookingId: 'booking-123', ttl: 60, urgent: true };

test('native registration accepts only Expo tokens and supported platforms and languages', () => {
  assert.equal(nativeSubscriptionSchema.safeParse({ token, platform: 'android', language: 'km' }).success, true);
  for (const invalid of ['https://attacker.invalid/push', 'ExpoPushToken[abc]/../', 'ExpoPushToken[]', ' ExpoPushToken[abc]', 'ExpoPushToken[a\nb]']) {
    assert.equal(expoTokenSchema.safeParse(invalid).success, false);
  }
  assert.equal(nativeSubscriptionSchema.safeParse({ token, platform: 'web', language: 'en' }).success, false);
  assert.equal(nativeSubscriptionSchema.safeParse({ token, platform: 'ios', language: 'de' }).success, false);
});

test('disabled native channel never calls a transport', async () => {
  process.env.NATIVE_PUSH_ENABLED = 'false';
  process.env.EXPO_PUSH_ACCESS_TOKEN = 'fixture-only-not-a-real-credential';
  assert.equal(nativePushConfigured(), false);
  await assert.rejects(sendNativePush(token, message, async () => { assert.fail('Unexpected outbound request'); }), { code: 'NOT_CONFIGURED' });
});

test('native delivery uses fixed origin, minimal private payload and checks its ticket', async () => {
  process.env.NATIVE_PUSH_ENABLED = 'true';
  process.env.EXPO_PUSH_ACCESS_TOKEN = 'fixture-only-not-a-real-credential';
  let calls = 0;
  const ticket = await sendNativePush(token, message, async (url, options) => {
    calls++;
    assert.equal(url, 'https://exp.host/--/api/v2/push/send');
    assert.equal(options.headers.Authorization, 'Bearer fixture-only-not-a-real-credential');
    const body = JSON.parse(options.body);
    assert.deepEqual(body.data, { recipientId: 'customer-123', eventKey: 'arrived:123', bookingId: 'booking-123' });
    assert.equal(body.channelId, 'trips');
    assert.equal(body.ttl, 60);
    assert.equal(body.priority, 'high');
    assert.deepEqual(Object.keys(body).sort(), ['body', 'channelId', 'data', 'priority', 'sound', 'title', 'to', 'ttl']);
    return Response.json({ data: { status: 'ok', id: 'ticket-123' } });
  });
  assert.equal(ticket, 'ticket-123');
  assert.equal(calls, 1);
});

test('native provider errors and malformed tickets are never reported as delivery success', async () => {
  for (const [response, code] of [
    [{ status: 'error', details: { error: 'DeviceNotRegistered' } }, 'DeviceNotRegistered'],
    [{ status: 'error', details: { error: 'MessageRateExceeded' } }, 'MessageRateExceeded'],
    [{ status: 'ok' }, 'INVALID_TICKET'],
  ]) await assert.rejects(sendNativePush(token, message, async () => Response.json({ data: response })), { code });
  await assert.rejects(sendNativePush(token, message, async () => new Response('', { status: 429 })), { code: 'HTTP_429' });
  await assert.rejects(sendNativePush(token, message, async () => Response.json({ data: { invalid: true } })));
});

test('receipt polling preserves per-device errors without claiming device delivery', async () => {
  const receipts = await nativePushReceipts(['a', 'b'], async (url, options) => {
    assert.equal(url, 'https://exp.host/--/api/v2/push/getReceipts');
    assert.deepEqual(JSON.parse(options.body), { ids: ['a', 'b'] });
    return Response.json({ data: { a: { status: 'ok' }, b: { status: 'error', details: { error: 'DeviceNotRegistered' } } } });
  });
  assert.equal(receipts.a.status, 'ok');
  assert.equal(receipts.b.details.error, 'DeviceNotRegistered');
});
