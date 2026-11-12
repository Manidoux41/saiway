import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { interfaceCopy } from '../src/lib/shared/interface-copy.ts';
import { createRequire } from 'node:module';

test('cloud build profiles embed the public HTTPS API without local environment files', () => {
  const config = JSON.parse(readFileSync(new URL('../eas.json', import.meta.url), 'utf8'));
  for (const profile of ['preview', 'production']) {
    assert.equal(config.build[profile].env.EXPO_PUBLIC_API_URL, 'https://saiway.vercel.app');
    assert.equal(new URL(config.build[profile].env.EXPO_PUBLIC_API_URL).protocol, 'https:');
  }
  assert.equal(config.build.preview.android.buildType, 'apk');
  assert.equal(config.build.preview.distribution, 'internal');
});

test('standalone shared history dictionary has complete translations', () => {
  for (const language of ['fr', 'km']) {
    assert.deepEqual(Object.keys(interfaceCopy[language]).sort(), Object.keys(interfaceCopy.en).sort());
    for (const value of Object.values(interfaceCopy[language])) assert.ok(value.trim());
  }
});

test('native notification configuration excludes unnecessary sensitive Android permissions', () => {
  const { expo } = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  assert.ok(expo.plugins.some(plugin => Array.isArray(plugin) && plugin[0] === 'expo-notifications'));
  for (const permission of [
    'android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.READ_MEDIA_IMAGES',
    'android.permission.READ_MEDIA_VIDEO', 'android.permission.READ_EXTERNAL_STORAGE',
    'android.permission.WRITE_EXTERNAL_STORAGE', 'android.permission.CAMERA',
    'android.permission.RECORD_AUDIO', 'android.permission.SYSTEM_ALERT_WINDOW',
    'com.google.android.gms.permission.AD_ID',
  ]) assert.ok(expo.android.blockedPermissions.includes(permission), permission);
  const config = createRequire(import.meta.url)('../app.config.js');
  const original = process.env.GOOGLE_SERVICES_JSON;
  try {
    process.env.GOOGLE_SERVICES_JSON = '/private-fixture/google-services.json';
    const generated = config({ config: expo });
    assert.equal(generated.android.googleServicesFile, '/private-fixture/google-services.json');
    assert.equal(generated.android.package, 'com.saiway.app');
    assert.deepEqual(generated.android.blockedPermissions, expo.android.blockedPermissions);
  } finally {
    if (original === undefined) delete process.env.GOOGLE_SERVICES_JSON;
    else process.env.GOOGLE_SERVICES_JSON = original;
  }
});
