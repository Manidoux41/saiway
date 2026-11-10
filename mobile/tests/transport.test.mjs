import { strict as assert } from 'node:assert';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { z } from 'zod';
import { ApiError, apiOrigin, createTransport, sessionCookie } from '../src/lib/transport.ts';

test('API configuration rejects missing, non-HTTPS production and non-origin URLs', () => {
  assert.equal(apiOrigin('https://saiway.example/', false), 'https://saiway.example');
  assert.equal(apiOrigin('http://192.168.1.10:3000', true), 'http://192.168.1.10:3000');
  for (const value of ['', 'http://saiway.example', 'https://user:pass@saiway.example', 'https://saiway.example/api', 'https://saiway.example/?key=x']) {
    assert.throws(() => apiOrigin(value, false));
  }
});

test('extracts account and guest cookies, including a cleared session', () => {
  assert.equal(sessionCookie('saiway_session=cs_abc; Path=/; HttpOnly'), 'saiway_session=cs_abc');
  assert.equal(sessionCookie('other=x; Path=/, saiway_session=signed.body; Path=/'), 'saiway_session=signed.body');
  assert.equal(sessionCookie('saiway_session=; Path=/; Max-Age=0'), null);
  assert.equal(sessionCookie('unrelated=x; Path=/'), undefined);
  assert.equal(sessionCookie('saiway_guest_ride=abc; HttpOnly', 'saiway_guest_ride'), 'saiway_guest_ride=abc');
});

test('fetch is invoked with the global receiver required by browser implementations', async () => {
  const transport = createTransport({
    origin: 'https://saiway.example', cookie: () => null, saveCookie: async () => {},
    fetch: async function (_url, init) {
      assert.equal(this, globalThis, 'Calling fetch as a transport method causes Illegal invocation in browsers');
      assert.equal(init.credentials, 'omit');
      return new Response('{"ready":true}', { headers: { 'content-type': 'application/json' } });
    },
  });
  assert.deepEqual(await transport.request('/api/guest-rides/session', z.object({ ready: z.boolean() })), { ready: true });
});

test('HTTP session journey: login -> authenticated write -> read -> forbidden -> logout', async t => {
  let booking = null;
  const server = createServer(async (req, res) => {
    res.setHeader('content-type', 'application/json');
    let raw = '';
    for await (const chunk of req) raw += chunk;
    if (req.url === '/api/auth/login') {
      assert.deepEqual(JSON.parse(raw), { email: 'client@example.test', password: 'test-password' });
      res.setHeader('set-cookie', 'saiway_session=cs_test; Path=/; HttpOnly');
      res.end(JSON.stringify({ ok: true }));
    } else if (req.headers.cookie !== 'saiway_session=cs_test') {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Customer access required' }));
    } else if (req.url === '/api/auth/logout') {
      res.setHeader('set-cookie', 'saiway_session=; Path=/; Max-Age=0');
      res.end(JSON.stringify({ ok: true }));
    } else if (req.url === '/api/driver/bookings') {
      res.statusCode = 403;
      res.end(JSON.stringify({ error: 'Driver access required' }));
    } else if (req.url === '/api/bookings' && req.method === 'POST') {
      booking = JSON.parse(raw);
      res.end(JSON.stringify({ booking }));
    } else {
      res.end(JSON.stringify({ bookings: booking ? [booking] : [] }));
    }
  });
  server.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  let cookie = null;
  const transport = createTransport({
    origin: `http://127.0.0.1:${server.address().port}`, fetch,
    cookie: () => cookie, saveCookie: async value => { cookie = value; },
  });
  const ok = z.object({ ok: z.boolean() });
  await assert.rejects(transport.request('/api/bookings', z.unknown()), error => error instanceof ApiError && error.status === 403);
  await transport.request('/api/auth/login', ok, { method: 'POST', body: { email: 'client@example.test', password: 'test-password' } });
  assert.equal(cookie, 'saiway_session=cs_test');
  const payload = { id: 'booking-test', fromAddress: 'SAI Airport', toAddress: 'Hotel', priceCents: 3000 };
  await transport.request('/api/bookings', z.object({ booking: z.object({ id: z.string() }) }), { method: 'POST', body: payload });
  const result = await transport.request('/api/bookings', z.object({ bookings: z.array(z.object({ id: z.string(), priceCents: z.number() })) }));
  assert.equal(result.bookings[0].id, payload.id);
  assert.equal(result.bookings[0].priceCents, 3000);
  await assert.rejects(transport.request('/api/driver/bookings', z.unknown()), error => error.status === 403 && error.message === 'Driver access required');
  await transport.request('/api/auth/logout', ok, { method: 'POST', body: {} });
  assert.equal(cookie, null);
  await assert.rejects(transport.request('/api/bookings', z.unknown()), error => error.status === 403);
});

test('transport never forwards credentials to an absolute or cross-origin path', async () => {
  let called = false;
  const transport = createTransport({
    origin: 'https://saiway.example',
    fetch: async () => { called = true; throw new Error('Unexpected request'); },
    cookie: () => 'saiway_session=secret', saveCookie: async () => {},
  });
  for (const path of ['https://other.example/api/', '//other.example/api/', '/api/\\other.example', '/account']) {
    await assert.rejects(transport.request(path, z.unknown()));
  }
  assert.equal(called, false);
});

test('transport preserves server errors and rejects incompatible response shapes', async () => {
  let status = 409;
  const transport = createTransport({
    origin: 'https://saiway.example',
    fetch: async () => new Response(JSON.stringify(status === 409 ? { error: 'GPS_INCOMPLETE_CONFIRM_ROUTE' } : { bookings: 'invalid' }),
      { status, headers: { 'content-type': 'application/json' } }),
    cookie: () => null, saveCookie: async () => {},
  });
  await assert.rejects(transport.request('/api/driver/bookings', z.unknown()), error =>
    error instanceof ApiError && error.status === 409 && error.message === 'GPS_INCOMPLETE_CONFIRM_ROUTE');
  status = 200;
  await assert.rejects(transport.request('/api/bookings', z.object({ bookings: z.array(z.object({ id: z.string() })) })));
});

test('guest session can be persisted and sent independently of account credentials', async () => {
  let cookie = null;
  let calls = 0;
  const transport = createTransport({
    origin: 'https://saiway.example', cookieName: 'saiway_guest_ride', cookie: () => cookie,
    saveCookie: async value => { cookie = value; },
    fetch: async (_url, init) => {
      calls++;
      assert.equal(init.credentials, 'omit');
      assert.equal(init.redirect, 'error');
      if (calls === 1) {
        assert.equal(init.headers.Cookie, undefined);
        return new Response('{"ready":true}', { headers: { 'content-type': 'application/json', 'set-cookie': 'saiway_guest_ride=guest123; HttpOnly' } });
      }
      assert.equal(init.headers.Cookie, 'saiway_guest_ride=guest123');
      return new Response('{"booking":null}', { headers: { 'content-type': 'application/json' } });
    },
  });
  await transport.request('/api/guest-rides/session', z.object({ ready: z.boolean() }));
  await transport.request('/api/guest-rides', z.object({ booking: z.null() }));
});

test('multipart uploads do not manually set a boundary or content type', async () => {
  const form = new FormData();
  form.append('side', 'FRONT');
  form.append('file', new Blob(['image']), 'license.png');
  const transport = createTransport({
    origin: 'https://saiway.example', cookie: () => 'saiway_session=driver', saveCookie: async () => {},
    fetch: async (_url, init) => {
      assert.equal(init.headers['Content-Type'], undefined);
      assert.equal(init.body, form);
      assert.equal(init.headers.Cookie, 'saiway_session=driver');
      return new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } });
    },
  });
  await transport.request('/api/driver/license', z.object({ ok: z.boolean() }), { method: 'POST', body: form });
});
