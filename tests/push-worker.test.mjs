import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function worker(authorized = true, offline = false, failFirst = false) {
  const listeners = {}, shown = [], opened = [], warnings = [], requests = [];
  const self = {
    addEventListener: (name, callback) => { listeners[name] = callback; },
    location: { origin: 'https://saiway.example' },
    registration: { showNotification: async (title, options) => shown.push({ title, ...options }) },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
  };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self, URL, AbortSignal, console: { warn: value => warnings.push(value), error: value => warnings.push(value) },
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (offline) throw new Error('Offline');
      return failFirst && requests.length === 1 ? { ok: false, status: 503 } : { ok: authorized, status: authorized ? 200 : 403 };
    },
  });
  async function push(data) {
    let promise;
    listeners.push({ data: { json: () => data }, waitUntil: value => { promise = value; } });
    await promise;
  }
  async function click(data) {
    let promise;
    listeners.notificationclick({ notification: { data, close() {} }, waitUntil: value => { promise = value; } });
    await promise;
  }
  return { shown, opened, warnings, requests, push, click };
}

test('closed-app push displays the localized message only for the authorized device and opens a role dashboard', async () => {
  const instance = worker();
  await instance.push({ body: 'Votre chauffeur est arrivé.', lang: 'fr', tag: 'trip-event', data: { subscriptionId: 'own-device', url: '/account' } });
  assert.equal(instance.shown.length, 1);
  assert.equal(instance.shown[0].body, 'Votre chauffeur est arrivé.');
  assert.equal(instance.shown[0].lang, 'fr');
  await instance.click(instance.shown[0].data);
  assert.equal(instance.opened[0], 'https://saiway.example/account');
  const loggedOut = worker(false);
  await loggedOut.push({ body: 'Private alert', data: { subscriptionId: 'old-device', url: '/driver' } });
  assert.equal(loggedOut.shown.length, 0);
  assert.equal(loggedOut.warnings.length, 1);
});

test('urgent closed-app push uses the encrypted device proof without requiring a window or login cookie', async () => {
  const instance = worker();
  await instance.push({ body: 'Demande GPS en attente d’attribution.', urgent: true, data: { subscriptionId: 'own-device', deviceToken: 'signed-expiring-proof', url: '/driver' } });
  assert.equal(instance.shown.length, 1);
  assert.equal(instance.shown[0].requireInteraction, true);
  assert.equal(instance.requests[0].options.headers.Authorization, 'Bearer signed-expiring-proof');
  assert.ok(instance.requests[0].options.signal instanceof AbortSignal);
  assert.equal(instance.shown[0].data.deviceToken, undefined, 'Proof must not be copied to notification click data');
  await instance.click(instance.shown[0].data);
  assert.equal(instance.opened[0], 'https://saiway.example/driver');
  const revoked = worker(false);
  await revoked.push({ body: 'Revoked device', data: { subscriptionId: 'old', deviceToken: 'proof', url: '/admin' } });
  assert.equal(revoked.shown.length, 0);
  const unavailable = worker(true, true);
  await unavailable.push({ body: 'Offline', data: { subscriptionId: 'own-device', deviceToken: 'proof' } });
  assert.equal(unavailable.shown.length, 0);
  assert.equal(unavailable.warnings.length, 2, 'Authorization failures and retry are reported, never bypassed');
  assert.equal(unavailable.requests.length, 2);
  const recovered = worker(true, false, true);
  await recovered.push({ body: 'Retry once', data: { subscriptionId: 'own-device', deviceToken: 'proof' } });
  assert.equal(recovered.requests.length, 2);
  assert.equal(recovered.shown.length, 1);
  assert.equal(revoked.requests.length, 1, 'Do not retry or bypass an explicit revocation');
});

test('notification clicks cannot open injected external URLs and malformed push is reported', async () => {
  const instance = worker();
  await instance.click({ url: 'https://attacker.invalid' });
  assert.equal(instance.opened[0], 'https://saiway.example/account');
  await instance.push({ body: 'Invalid' });
  assert.equal(instance.shown.length, 0);
  assert.equal(instance.warnings.length, 1);
});

test('assigned driver push deep-links to the exact booking without permitting URL injection', async () => {
  const instance = worker();
  await instance.push({ body: 'Assigned', data: { subscriptionId: 'own-device', url: '/driver', bookingId: 'cm-driver-booking123', deviceToken: 'private' } });
  await instance.click(instance.shown[0].data);
  assert.equal(instance.opened[0], 'https://saiway.example/driver?booking=cm-driver-booking123');
  assert.equal(instance.shown[0].data.deviceToken, undefined);
  for (const bookingId of ['../admin', 'x&url=https://attacker.invalid', 'x'.repeat(201)]) {
    await instance.push({ body: 'Assigned', data: { subscriptionId: 'own-device', url: '/driver', bookingId } });
    await instance.click(instance.shown.at(-1).data);
    assert.equal(instance.opened.at(-1), 'https://saiway.example/driver');
  }
});
