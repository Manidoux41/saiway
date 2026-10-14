import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('the service worker never intercepts or caches API responses', () => {
  const handlers = new Map();
  runInNewContext(source, {
    URL,
    self: { addEventListener: (name, handler) => handlers.set(name, handler) },
    caches: { open: () => assert.fail('API data must not be cached'), match: () => assert.fail('API data must not use a cached fallback') },
    fetch: () => assert.fail('API requests must be handled by the browser, not the worker'),
  });
  for (const path of ['/api/admin/management', '/api/account/profile', '/api/admin/users']) {
    handlers.get('fetch')({
      request: { method: 'GET', mode: 'cors', url: `http://localhost:3000${path}` },
      respondWith: () => assert.fail('API requests must not be intercepted'),
    });
  }
  handlers.get('fetch')({
    request: { method: 'POST', mode: 'cors', url: 'http://localhost:3000/api/admin/users' },
    respondWith: () => assert.fail('Writes must not be intercepted'),
  });
});

test('worker activation removes the old cache containing API responses', async () => {
  const handlers = new Map();
  const deleted = [];
  let activation;
  runInNewContext(source, {
    self: { addEventListener: (name, handler) => handlers.set(name, handler), clients: { claim: () => {} } },
    caches: { keys: async () => ['saiway-shell-v3', 'saiway-shell-v4'], delete: async (key) => { deleted.push(key); } },
  });
  handlers.get('activate')({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['saiway-shell-v3']);
});
