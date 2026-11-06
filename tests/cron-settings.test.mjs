import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gpsRetentionEnabled } from '../lib/cron-settings.ts';

test('GPS retention preserves enabled defaults and honors explicit pause', () => {
  assert.equal(gpsRetentionEnabled(undefined), true);
  assert.equal(gpsRetentionEnabled(null), true);
  assert.equal(gpsRetentionEnabled('true'), true);
  assert.equal(gpsRetentionEnabled('false'), false);
});

test('invalid stored GPS retention settings cannot silently enable deletion', () => {
  for (const value of ['', 'TRUE', '0', 'yes']) {
    assert.throws(() => gpsRetentionEnabled(value), /Invalid GPS retention setting/);
  }
});
