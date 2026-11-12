import assert from 'node:assert/strict';
import test from 'node:test';
import { routeFixture } from './route-unit-fixture.mjs';

test('native registration retains token rotation cleanup information and binds it to the API origin', async () => {
  const storage = new Map();
  const native = routeFixture('mobile/src/lib/native-push.ts', {
    'expo-secure-store': {
      getItemAsync: async key => storage.get(key) ?? null,
      setItemAsync: async (key, value) => { storage.set(key, value); },
      deleteItemAsync: async key => { storage.delete(key); },
    },
    './api': { configuredOrigin: () => 'https://saiway.example' },
  });
  await native.savePushRegistration('new-token', 'customer1', 'old-token');
  const saved = await native.savedPushRegistration();
  assert.equal(saved.origin, 'https://saiway.example');
  assert.equal(saved.userId, 'customer1');
  assert.equal(saved.previousToken, 'old-token');
  await native.savePushRegistration('new-token', 'customer1');
  assert.equal((await native.savedPushRegistration()).previousToken, undefined);
  await native.clearPushRegistration();
  assert.equal(await native.savedPushRegistration(), null);
});

test('logout invalidation prevents queued stale subscriptions and serializes token removal', async () => {
  const native = routeFixture('mobile/src/lib/native-push.ts', {
    'expo-secure-store': {},
    './api': {},
  });
  const events = [];
  let release;
  const blocker = new Promise(resolve => { release = resolve; });
  const running = native.withPushLock(async () => { events.push('register-start'); await blocker; events.push('register-finish'); });
  const captured = native.pushRevision();
  const queued = native.withPushLock(async () => { if (captured === native.pushRevision()) events.push('stale-register'); });
  native.invalidatePushOperations();
  const logout = native.withPushLock(async () => { events.push('remove-device'); });
  release();
  await Promise.all([running, queued, logout]);
  assert.deepEqual(events, ['register-start', 'register-finish', 'remove-device']);
  await assert.rejects(native.withPushLock(async () => { throw new Error('registration failed'); }));
  assert.equal(await native.withPushLock(async () => 'still works'), 'still works');
});
