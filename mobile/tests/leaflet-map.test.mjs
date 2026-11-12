import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { leafletMapHtml, mapUpdateScript, parseMapMessage } from '../src/lib/leaflet-map.ts';

function mapRuntime() {
  const messages = [], markers = [], lines = [], fits = [], handlers = {};
  const map = {
    setView() { return this; }, fitBounds(points) { fits.push(points); },
    on(type, handler) { handlers[type] = handler; }, invalidateSize() {},
  };
  const layer = { addTo() { return this; }, clearLayers() { markers.length = 0; lines.length = 0; } };
  const context = vm.createContext({
    window: { ReactNativeWebView: { postMessage(value) { messages.push(JSON.parse(value)); } }, addEventListener() {} },
    document: {
      createElement() { return { textContent: '' }; }, addEventListener() {},
      querySelector() { return { setAttribute() {} }; },
    },
    L: {
      map() { return map; }, layerGroup() { return layer; },
      tileLayer() { return { on(type, handler) { handlers[type] = handler; return this; }, addTo() {} }; },
      circleMarker(point) {
        const marker = { point, bindTooltip(node) { this.label = node.textContent; return this; }, addTo() { markers.push(this); } };
        return marker;
      },
      polyline(points) { return { addTo() { lines.push(points); } }; },
      latLngBounds(points) { return points; },
    },
  });
  context.window.L = context.L;
  const scripts = [...leafletMapHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  for (const [, script] of scripts) vm.runInContext(script, context);
  return { context, messages, markers, lines, fits, handlers };
}

const data = {
  from: { latitude: 13.36, longitude: 103.85 },
  to: { latitude: 13.4, longitude: 103.9 },
  driver: { latitude: 13.37, longitude: 103.86 },
  hubs: [{ id: 'hub', name: '<img src=x onerror=alert(1)>', latitude: 13.38, longitude: 103.87 }],
  route: [[103.85, 13.36], [103.9, 13.4]],
  history: [{ latitude: 13.36, longitude: 103.85 }, { latitude: 13.37, longitude: 103.86 }],
  labels: { from: 'Departure', to: 'Destination', driver: 'Driver', zoomIn: 'Zoom in', zoomOut: 'Zoom out' },
  picking: true,
};

test('Leaflet draws every marker and converts API longitude/latitude routes without rewriting labels', () => {
  const runtime = mapRuntime();
  vm.runInContext(mapUpdateScript(data), runtime.context);
  assert.deepEqual(runtime.messages, [{ type: 'ready' }]);
  assert.equal(runtime.markers.length, 4);
  assert.equal(runtime.markers[3].label, data.hubs[0].name);
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.lines)), [
    [[13.36, 103.85], [13.4, 103.9]], [[13.36, 103.85], [13.37, 103.86]],
  ]);
  assert.equal(runtime.fits.length, 1);
  vm.runInContext(mapUpdateScript({ ...data, driver: { latitude: 13.39, longitude: 103.88 } }), runtime.context);
  assert.equal(runtime.fits.length, 1, 'driver polling must not reset the viewport');
  vm.runInContext(mapUpdateScript({ ...data, labels: { ...data.labels, from: 'Départ' } }), runtime.context);
  assert.equal(runtime.markers[0].label, 'Départ');
});

test('map picks are emitted only for editable maps and failures are surfaced', () => {
  const runtime = mapRuntime();
  vm.runInContext(mapUpdateScript(data), runtime.context);
  runtime.handlers.click({ latlng: { lat: 13.36, lng: 103.85 } });
  assert.deepEqual(runtime.messages.at(-1), { type: 'pick', latitude: 13.36, longitude: 103.85 });
  const count = runtime.messages.length;
  vm.runInContext(mapUpdateScript({ ...data, picking: false }), runtime.context);
  runtime.handlers.click({ latlng: { lat: 13.36, lng: 103.85 } });
  assert.equal(runtime.messages.length, count);
  runtime.handlers.tileerror();
  assert.deepEqual(runtime.messages.at(-1), { type: 'error', reason: 'tiles' });
});

test('bridge rejects malformed coordinates and script serialization prevents HTML injection', () => {
  assert.throws(() => parseMapMessage('not json'));
  assert.throws(() => parseMapMessage('{"type":"pick","latitude":91,"longitude":0}'));
  assert.throws(() => parseMapMessage('{"type":"pick","latitude":13,"longitude":181}'));
  assert.throws(() => parseMapMessage('{"type":"pick","latitude":"13","longitude":103}'));
  assert.throws(() => parseMapMessage('{"type":"link","url":"https://example.com"}'));
  assert.deepEqual(parseMapMessage('{"type":"pick","latitude":13,"longitude":103}'), { type: 'pick', latitude: 13, longitude: 103 });
  assert.ok(!mapUpdateScript({ ...data, labels: { ...data.labels, from: '</script>' } }).includes('</script>'));
});
