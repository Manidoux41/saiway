import assert from 'node:assert/strict';
import test from 'node:test';
import * as nativePush from '../lib/native-push.ts';
import { routeFixture, jsonRequest } from './route-unit-fixture.mjs';

test('native subscriptions persist, update language, reject takeover and unregister only their owner', async () => {
  let user = null;
  const devices = [];
  const tx = {
    $queryRaw: async () => [],
    pushSubscription: {
      findUnique: async ({ where }) => devices.find(device => device.endpoint === where.endpoint),
      findFirst: async ({ where }) => devices.find(device => device.endpoint === where.endpoint && device.userId === where.userId && device.channel === where.channel),
      count: async ({ where }) => devices.filter(device => device.userId === where.userId).length,
      create: async ({ data }) => { devices.push({ ...data, id: `device${devices.length}` }); },
      update: async ({ where, data }) => Object.assign(devices.find(device => device.id === where.id), data),
      deleteMany: async ({ where }) => {
        const index = devices.findIndex(device => device.userId === where.userId && device.endpoint === where.endpoint && device.channel === where.channel);
        if (index >= 0) devices.splice(index, 1);
      },
    },
  };
  const route = routeFixture('app/api/notifications/native/route.ts', {
    '@/lib/access': { activeAccount: async () => user },
    '@/lib/prisma': { prisma: { ...tx, $transaction: action => action(tx) } },
    '@/lib/native-push': { ...nativePush, nativePushConfigured: () => true },
  });
  const token = 'ExpoPushToken[fixture123]';
  const body = { token, platform: 'android', language: 'en' };
  assert.equal((await route.POST(jsonRequest('/api/notifications/native', body))).status, 401);
  user = { id: 'alice', role: 'CUSTOMER' };
  assert.equal((await route.POST(jsonRequest('/api/notifications/native', body))).status, 201);
  assert.equal(devices.length, 1);
  assert.equal(devices[0].channel, 'EXPO');
  const status = await route.GET(jsonRequest(`/api/notifications/native?token=${encodeURIComponent(token)}`, undefined, 'GET'));
  assert.equal((await status.json()).enabled, true);
  await route.POST(jsonRequest('/api/notifications/native', { ...body, language: 'km' }));
  assert.equal(devices.length, 1);
  assert.equal(devices[0].language, 'km');
  user = { id: 'bob', role: 'DRIVER' };
  assert.equal((await route.POST(jsonRequest('/api/notifications/native', body))).status, 409);
  await route.DELETE(jsonRequest('/api/notifications/native', { token }, 'DELETE'));
  assert.equal(devices.length, 1);
  user = { id: 'alice', role: 'CUSTOMER' };
  await route.DELETE(jsonRequest('/api/notifications/native', { token }, 'DELETE'));
  assert.equal(devices.length, 0);
  assert.equal((await route.POST(jsonRequest('/api/notifications/native', { ...body, token: 'https://attacker.invalid' }))).status, 400);
});
