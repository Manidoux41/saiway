import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');

test('the service worker never intercepts or caches API responses', () => {
  const handlers = new Map();
  runInNewContext(source, {
    URL,
    self: { location: { origin: 'http://localhost:3000' }, addEventListener: (name, handler) => handlers.set(name, handler) },
    caches: { open: () => assert.fail('API data must not be cached'), match: () => assert.fail('API data must not use a cached fallback') },
    fetch: () => assert.fail('API requests must be handled by the browser, not the worker'),
  });
  for (const path of ['/api/admin/management', '/api/account/profile', '/api/admin/users', '/api/bookings', '/api/driver/bookings']) {
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

test('the worker never caches authenticated pages, navigations or RSC payloads', async () => {
  const handlers = new Map();
  const installed = [];
  let installation;
  runInNewContext(source, {
    URL,
    self: { location: { origin: 'http://localhost:3000' }, addEventListener: (name, handler) => handlers.set(name, handler), skipWaiting: () => {} },
    caches: { open: async () => ({ addAll: async (paths) => installed.push(...paths) }), match: () => assert.fail('Private content must not read cache') },
    fetch: () => assert.fail('Private content must not be intercepted'),
  });
  handlers.get('install')({ waitUntil: (promise) => { installation = promise; } });
  await installation;
  assert.deepEqual(installed, ['/icons/icon-192.svg', '/icons/icon-512.svg', '/manifest.webmanifest']);
  for (const path of ['/', '/auth', '/admin', '/driver', '/account', '/booking', '/admin?_rsc=test']) {
    for (const mode of ['navigate', 'cors']) handlers.get('fetch')({
      request: { method: 'GET', mode, url: `http://localhost:3000${path}` },
      respondWith: () => assert.fail('Authenticated pages must not be intercepted'),
    });
  }
});

test('worker activation removes the old cache containing API responses', async () => {
  const handlers = new Map();
  const deleted = [];
  let activation;
  runInNewContext(source, {
    self: { addEventListener: (name, handler) => handlers.set(name, handler), clients: { claim: () => {} } },
    caches: { keys: async () => ['saiway-shell-v4', 'saiway-shell-v5'], delete: async (key) => { deleted.push(key); } },
  });
  handlers.get('activate')({ waitUntil: (promise) => { activation = promise; } });
  await activation;
  assert.deepEqual(deleted, ['saiway-shell-v4']);
});
