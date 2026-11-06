import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function worker(authorized = true) {
  const listeners = {}, shown = [], opened = [], warnings = [];
  const self = {
    addEventListener: (name, callback) => { listeners[name] = callback; },
    location: { origin: 'https://saiway.example' },
    registration: { showNotification: async (title, options) => shown.push({ title, ...options }) },
    clients: { matchAll: async () => [], openWindow: async url => opened.push(url) },
  };
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self, URL, console: { warn: value => warnings.push(value), error: value => warnings.push(value) },
    fetch: async () => ({ ok: authorized }),
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
  return { shown, opened, warnings, push, click };
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

test('notification clicks cannot open injected external URLs and malformed push is reported', async () => {
  const instance = worker();
  await instance.click({ url: 'https://attacker.invalid' });
  assert.equal(instance.opened[0], 'https://saiway.example/account');
  await instance.push({ body: 'Invalid' });
  assert.equal(instance.shown.length, 0);
  assert.equal(instance.warnings.length, 1);
});
