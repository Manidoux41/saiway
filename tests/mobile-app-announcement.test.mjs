import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mobileAppCopy } from '../components/i18n/mobile-app-copy.ts';

test('native application announcement clearly states future availability in all site languages', () => {
  assert.deepEqual(Object.keys(mobileAppCopy).sort(), ['en', 'fr', 'km']);
  for (const [language, copy] of Object.entries(mobileAppCopy)) {
    assert.match(copy.title, /Android/);
    assert.match(copy.title, /iOS/);
    assert.ok(copy.description.trim());
    assert.ok(copy.soon.trim());
    if (language === 'km') assert.match(copy.soon, /[\u1780-\u17ff]/);
  }
  assert.match(mobileAppCopy.fr.soon, /prochainement/);
  assert.match(mobileAppCopy.en.soon, /Coming/);
});
