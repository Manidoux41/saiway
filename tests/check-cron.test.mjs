import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('operator check refuses legacy deployments, diagnoses secret mismatch and uses only dry runs', async () => {
  const secret = 'private-disposable-check-secret';
  let mode = 'legacy';
  let authenticated = 0;
  const server = http.createServer((request, response) => {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, mode === 'legacy' ? {} : { 'X-Saiway-Cron-Dry-Run': '1' });
      return response.end();
    }
    const valid = request.headers.authorization === `Bearer ${secret}`;
    if (valid) authenticated++;
    if (!valid || mode === 'mismatch') {
      response.writeHead(401, { 'Content-Type': 'application/json' });
      return response.end(JSON.stringify({ error: 'Unauthorized' }));
    }
    assert.equal(new URL(request.url, 'http://localhost').searchParams.get('dryRun'), 'true');
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ dryRun: true, configured: true, sent: 0, removed: 0 }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  async function run() {
    const child = spawn(process.execPath, ['scripts/check-cron.mjs', origin], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, CRON_SECRET: secret }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.stderr.on('data', data => { output += data; });
    const code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
    assert.ok(!output.includes(secret), 'diagnostics must never print credentials');
    return { code, output };
  }
  try {
    const legacy = await run();
    assert.equal(legacy.code, 1);
    assert.match(legacy.output, /deploy the version/);
    assert.equal(authenticated, 0, 'never authenticate an old handler that would ignore dryRun');
    mode = 'mismatch';
    const mismatch = await run();
    assert.equal(mismatch.code, 1);
    assert.match(mismatch.output, /matches Vercel Production/);
    mode = 'ready';
    const ready = await run();
    assert.equal(ready.code, 0);
    assert.equal((ready.output.match(/: PASS/g) ?? []).length, 2);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
