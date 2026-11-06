import assert from 'node:assert/strict';
import { test } from 'node:test';
import { coordinateAddress, parseCoordinateAddress } from '../lib/booking-location.ts';
import { navigationUrl } from '../lib/driver-dashboard.ts';
import { searchPlaces } from '../lib/place-search.ts';

test('coordinate addresses preserve accurate points, including zero and negative values', () => {
  for (const point of [{ latitude: 13.3612345, longitude: 103.8567891 }, { latitude: 0, longitude: 0 }, { latitude: -90, longitude: -180 }]) {
    assert.deepEqual(parseCoordinateAddress(coordinateAddress(point)), point);
  }
  assert.deepEqual(parseCoordinateAddress('13.36, 103.85'), { latitude: 13.36, longitude: 103.85 });
  for (const invalid of ['GPS: 91, 0', 'GPS: 0, -181', 'GPS: hello', 'GPS: NaN, 3', 'Hotel name']) {
    assert.equal(parseCoordinateAddress(invalid), null);
  }
  assert.throws(() => coordinateAddress({ latitude: NaN, longitude: 3 }));
});

test('driver place searches can scope Cambodia without dropping English or Khmer input', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      const params = new URL(url).searchParams;
      assert.equal(params.get('bbox'), '102.3,9.9,107.7,14.8');
      assert.equal(params.get('q'), 'សៀមរាប');
      return Response.json({ features: [{ geometry: { coordinates: [103.85, 13.36] }, properties: { name: 'សៀមរាប', country: 'Cambodia' } }] });
    };
    const places = await searchPlaces('សៀមរាប', new AbortController().signal, true);
    assert.equal(places[0].name, 'សៀមរាប');
  } finally { globalThis.fetch = original; }
});

test('driver navigation sends coordinate pairs without the stored GPS prefix', () => {
  const url = new URL(navigationUrl({ fromAddress: 'GPS: 13.3612345, 103.8567891', toAddress: 'Phnom Penh' }));
  assert.equal(url.searchParams.get('origin'), '13.3612345, 103.8567891');
  assert.equal(url.searchParams.get('destination'), 'Phnom Penh');
});

test('place search accepts city and landmark results outside Siem Reap and validates responses', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async url => {
      const params = new URL(url).searchParams;
      assert.equal(params.get('q'), 'Phnom Penh');
      assert.equal(params.has('bbox'), false);
      return Response.json({ features: [{ geometry: { coordinates: [104.9282, 11.5564] }, properties: { name: 'Royal Palace', city: 'Phnom Penh', country: 'Cambodia' } }] });
    };
    const results = await searchPlaces('Phnom Penh', new AbortController().signal);
    assert.deepEqual(results[0], { name: 'Royal Palace', detail: 'Phnom Penh, Cambodia', latitude: 11.5564, longitude: 104.9282 });
    globalThis.fetch = async () => Response.json({ features: [{ geometry: { coordinates: [999, 0] }, properties: {} }] });
    await assert.rejects(searchPlaces('Phnom Penh', new AbortController().signal));
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(searchPlaces('Phnom Penh', new AbortController().signal), /unavailable/);
  } finally { globalThis.fetch = original; }
});
