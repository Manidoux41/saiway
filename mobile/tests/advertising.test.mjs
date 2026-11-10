import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { advertisementImagePath, advertisementsSchema, advertisingPlacement, drivingStatuses, nextAdvertisement } from '../src/lib/advertising.ts';

const ad = (overrides = {}) => ({
  id: 'ad/test', advertiser: 'Partner', title: 'Visit Siem Reap', description: 'Local experience',
  targetUrl: 'https://partner.example/offer', endsAt: '2099-12-10T00:00:00Z',
  image: { updatedAt: '2026-11-10T00:00:00Z' }, ...overrides,
});
test('advertising placements follow existing API placement names and exclude sensitive screens', () => {
  assert.equal(advertisingPlacement('/auth'), 'HOME');
  assert.equal(advertisingPlacement('/trips', 'customer'), 'HOME');
  assert.equal(advertisingPlacement('/book', 'customer'), 'BOOKING');
  assert.equal(advertisingPlacement('/trips', 'driver'), 'DRIVER');
  for (const path of ['/trip/123', '/walkup', '/finance', '/documents', '/account', '/guest']) {
    assert.equal(advertisingPlacement(path, 'driver'), null);
    assert.equal(advertisingPlacement(path, 'customer'), null);
  }
  assert.equal(advertisingPlacement('/book', 'driver'), null);
  for (const status of ['DRIVER_ACCEPTED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'TRIP_STARTED']) {
    assert.ok(drivingStatuses.includes(status));
  }
});
test('expired campaigns are hidden and API priority order is preserved', () => {
  const now = Date.parse('2026-11-10T00:00:00Z');
  const expired = ad({ id: 'expired', endsAt: '2026-11-10T00:00:00Z' });
  const first = ad({ id: 'priority-first' });
  const second = ad({ id: 'priority-second' });
  assert.equal(nextAdvertisement([expired, first, second], now).id, 'priority-first');
  assert.equal(nextAdvertisement([expired], now), null);
  assert.equal(nextAdvertisement([], now), null);
});
test('campaigns reject unsafe external links and validate expiry timestamps', () => {
  assert.equal(advertisementsSchema.parse({ advertisements: [ad()] }).advertisements.length, 1);
  for (const targetUrl of ['http://partner.example', 'javascript:alert(1)', 'https://user:pass@partner.example']) {
    assert.throws(() => advertisementsSchema.parse({ advertisements: [ad({ targetUrl })] }));
  }
  assert.throws(() => advertisementsSchema.parse({ advertisements: [ad({ endsAt: 'invalid' })] }));
  assert.match(advertisementImagePath(ad()), /^\/api\/advertising\/ad%2Ftest\/image\?version=2026/);
  assert.throws(() => advertisementImagePath(ad({ image: null })));
});
