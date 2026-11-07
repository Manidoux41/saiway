import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { authorizedCron, cronDryRun, cronHead, cronOptions } from '../lib/cron-auth.ts';

test('automated endpoints fail closed without a secret and require its exact bearer value', () => {
  const previous = process.env.CRON_SECRET;
  const request = authorization => new Request('https://example.invalid/api/cron/test', { headers: authorization ? { authorization } : {} });
  try {
    delete process.env.CRON_SECRET;
    assert.equal(authorizedCron(request()), false);
    process.env.CRON_SECRET = 'disposable-test-secret';
    for (const value of [undefined, 'wrong', 'disposable-test-secret', 'Basic disposable-test-secret', 'Bearer wrong', 'Bearer disposable-test-secreu']) assert.equal(authorizedCron(request(value)), false);
    assert.equal(authorizedCron(request('Bearer disposable-test-secret')), true);
    assert.equal(authorizedCron(request('bearer disposable-test-secret')), true);
  } finally {
    if (previous === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous;
  }
});

test('Vercel Hobby deployment declares no scheduled jobs and environment example has no duplicate keys', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  assert.equal(config.crons?.length ?? 0, 0);
  const keys = [...readFileSync(new URL('../.env.example', import.meta.url), 'utf8').matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map(match => match[1]);
  assert.equal(keys.length, new Set(keys).size);
});

test('dry-run parameters fail closed and safe HEAD requires authentication', () => {
  const request = query => new Request(`https://example.invalid/api/cron/test${query}`);
  assert.equal(cronDryRun(request('')), false);
  assert.equal(cronDryRun(request('?dryRun=false')), false);
  assert.equal(cronDryRun(request('?dryRun=true')), true);
  for (const query of ['?dryRun=1', '?dryrun=true', '?dryRun=true&dryRun=false', '?secret=example', '?dryRun=']) {
    assert.equal(cronDryRun(request(query)), null);
  }
  assert.equal(cronHead(request('')).status, 401);
  assert.equal(cronOptions().status, 204);
  assert.equal(cronOptions().headers.get('X-Saiway-Cron-Dry-Run'), '1');
});
