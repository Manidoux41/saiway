import test from 'node:test';
import assert from 'node:assert/strict';
import { pushDeviceToken, readPushDeviceToken } from '../lib/push-device-token.ts';

test('background device proof is signed, bound to one subscription and role, expiring and tamper-resistant', () => {
  const previous = process.env.AUTH_SECRET;
  process.env.AUTH_SECRET = 'isolated-push-unit-validation-only';
  try {
    const token = pushDeviceToken('device-1', 'ADMIN', new Date(Date.now() + 60000));
    assert.deepEqual(readPushDeviceToken(token, 'device-1'), { role: 'ADMIN' });
    assert.equal(readPushDeviceToken(token, 'device-2'), null);
    assert.equal(readPushDeviceToken(`${token}x`, 'device-1'), null);
    assert.equal(readPushDeviceToken(`${token}.extra`, 'device-1'), null);
    assert.equal(readPushDeviceToken('malformed', 'device-1'), null);
    assert.equal(readPushDeviceToken(pushDeviceToken('device-1', 'ADMIN', new Date(0)), 'device-1'), null);
    assert.equal(readPushDeviceToken(pushDeviceToken('device-1', 'OTHER', new Date(Date.now() + 60000)), 'device-1'), null);
    process.env.AUTH_SECRET = 'different-signing-key';
    assert.equal(readPushDeviceToken(token, 'device-1'), null);
  } finally {
    if (previous === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = previous;
  }
});
