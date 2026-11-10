import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../components/driver/use-location-sharing.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const settle = async () => { for (let index = 0; index < 8; index++) await new Promise(resolve => setImmediate(resolve)); };

function harness(fetchOverride) {
  let time = Date.now();
  class Clock extends Date {
    constructor(...args) { super(...(args.length ? args : [time])); }
    static now() { return time; }
  }
  const document = new EventTarget();
  document.visibilityState = "visible";
  const window = new EventTarget();
  const timers = new Map();
  window.setInterval = callback => { timers.set(timers.size + 1, callback); return timers.size; };
  window.clearInterval = id => timers.delete(id);
  const watches = new Map();
  let nextWatch = 0;
  const options = [];
  const navigator = {
    onLine: true,
    geolocation: {
      watchPosition(success, error, settings) { const id = ++nextWatch; watches.set(id, { success, error }); options.push(settings); return id; },
      clearWatch(id) { watches.delete(id); },
    },
  };
  let cleanup;
  const values = [];
  let index = 0;
  const requests = [];
  const exports = {};
  runInNewContext(source, {
    exports, Date: Clock, Event, AbortController, AbortSignal, document, window, navigator,
    require: name => {
      assert.equal(name, "react");
      return {
        useState(initial) { const id = index++; values[id] = typeof initial === "function" ? initial() : initial; return [values[id], update => { values[id] = typeof update === "function" ? update(values[id]) : update; }]; },
        useEffect(effect) { cleanup = effect(); },
      };
    },
    fetch: async (url, init) => {
      requests.push({ url, ...init });
      if (fetchOverride) return fetchOverride(url, init);
      return { ok: true, json: async () => init?.method === "PUT" ? { accepted: true, recordedAt: JSON.parse(init.body).capturedAt } : { enabled: true, returningToHub: false, hubs: [], location: null, vehicle: null } };
    },
  });
  exports.useLocationSharing("trip-a", true);
  return {
    values, requests, options, document, window, navigator, watches, timers,
    get state() { return values[0]; },
    advance(ms) { time += ms; },
    async tick() { for (const callback of timers.values()) callback(); await settle(); },
    async position(age = 0) { for (const watch of [...watches.values()]) watch.success({ timestamp: time - age, coords: { latitude: 13.36, longitude: 103.85, accuracy: 10, heading: 90 } }); await settle(); },
    stop() { cleanup(); },
  };
}

test("driver GPS reacquires a fresh watch on foreground, page restoration and reconnect", async () => {
  const h = harness();
  try {
    await settle();
    assert.equal(h.watches.size, 1);
    assert.equal(h.options[0].maximumAge, 0);
    await h.position();
    assert.equal(h.state.phase, "sharing");
    const sentAt = h.state.lastSent.getTime();
    h.document.visibilityState = "hidden";
    h.advance(120000);
    h.document.dispatchEvent(new Event("visibilitychange"));
    await h.tick();
    assert.equal(h.state.phase, "stale");
    assert.equal(h.state.lastSent.getTime(), sentAt);
    h.document.visibilityState = "visible";
    h.document.dispatchEvent(new Event("visibilitychange"));
    await settle();
    assert.equal(h.watches.size, 1);
    assert.equal(h.options.length, 2);
    await h.position();
    assert.equal(h.state.lastSent.getTime(), sentAt + 120000);
    h.window.dispatchEvent(new Event("pageshow"));
    await settle();
    assert.equal(h.options.length, 3);
    h.navigator.onLine = false;
    h.window.dispatchEvent(new Event("offline"));
    assert.equal(h.state.phase, "offline");
    const count = h.requests.length;
    await h.position();
    assert.equal(h.requests.length, count);
    h.navigator.onLine = true;
    h.window.dispatchEvent(new Event("online"));
    await settle();
    assert.equal(h.options.length, 4);
    assert.equal(h.watches.size, 1);
  } finally { h.stop(); }
  assert.equal(h.watches.size, 0);
  assert.equal(h.timers.size, 0);
});

test("stale GPS measurements never get resent as a fresh heartbeat", async () => {
  const h = harness();
  try {
    await settle();
    await h.position(61000);
    assert.equal(h.state.phase, "stale");
    assert.equal(h.requests.filter(request => request.method === "PUT").length, 0);
    await h.position();
    h.advance(16000);
    await h.tick();
    const puts = h.requests.filter(request => request.method === "PUT");
    assert.equal(puts.length, 2);
    assert.equal(JSON.parse(puts[0].body).capturedAt, JSON.parse(puts[1].body).capturedAt);
    h.advance(60000);
    await h.tick();
    assert.equal(h.requests.filter(request => request.method === "PUT").length, 2);
    assert.equal(h.options.length, 2);
  } finally { h.stop(); }
});

test("failed initial status fetch retries automatically without leaving a dead GPS session", async () => {
  let failures = 1;
  const h = harness(async () => {
    if (failures-- > 0) throw new Error("Network unavailable");
    return { ok: true, json: async () => ({ enabled: true, hubs: [], vehicle: null, location: null }) };
  });
  try {
    await settle();
    assert.equal(h.state.phase, "error");
    h.advance(16000);
    await h.tick();
    assert.equal(h.watches.size, 1);
  } finally { h.stop(); }
});

test("cleanup aborts pending requests and ignores late GPS callbacks", async () => {
  const h = harness();
  await settle();
  const oldWatch = [...h.watches.values()][0];
  await h.position();
  h.stop();
  assert.ok(h.requests.every(request => request.signal.aborted));
  const before = h.requests.length;
  oldWatch.success({ timestamp: Date.now(), coords: { latitude: 13.37, longitude: 103.86, accuracy: 10, heading: null } });
  await settle();
  assert.equal(h.requests.length, before);
  h.window.dispatchEvent(new Event("online"));
  await settle();
  assert.equal(h.watches.size, 0);
});
