import assert from 'node:assert/strict';
import test from 'node:test';
import { routeFixture, jsonRequest } from './route-unit-fixture.mjs';

test('account deletion verifies password, persists one pending request and restricts read-back to its owner', async () => {
  let user = null;
  const requests = [];
  const tx = {
    $queryRaw: async () => [],
    user: { findUniqueOrThrow: async () => ({ passwordHash: 'fixture-hash' }) },
    accountDeletionRequest: {
      findFirst: async ({ where }) => requests.find(item => item.userId === where.userId && (!where.status || item.status === where.status)) ?? null,
      create: async ({ data }) => {
        const result = { ...data, id: 'request123', status: 'PENDING', createdAt: new Date().toISOString() };
        requests.push(result); return result;
      },
    },
  };
  const route = routeFixture('app/api/account/deletion/route.ts', {
    '@/lib/access': { activeAccount: async () => user },
    '@/lib/prisma': { prisma: { ...tx, $transaction: action => action(tx) } },
    '@/lib/passwords': { verifyPassword: (password, hash) => password === 'correct-fixture-password' && hash === 'fixture-hash' },
  });
  const submit = password => route.POST(jsonRequest('/api/account/deletion', { password, confirmed: true }));
  assert.equal((await submit('correct-fixture-password')).status, 401);
  user = { id: 'alice' };
  assert.equal((await submit('wrong')).status, 403);
  assert.equal(requests.length, 0);
  assert.equal((await submit('correct-fixture-password')).status, 202);
  assert.equal((await submit('correct-fixture-password')).status, 202);
  assert.equal(requests.length, 1);
  const own = await route.GET(jsonRequest('/api/account/deletion', undefined, 'GET'));
  assert.equal((await own.json()).deletion.id, 'request123');
  user = { id: 'bob' };
  const other = await route.GET(jsonRequest('/api/account/deletion', undefined, 'GET'));
  assert.equal((await other.json()).deletion, null);
});
