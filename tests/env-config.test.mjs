import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const configUrl = new URL('../prisma.config.ts', import.meta.url).href;
const urls = {
  default: 'postgresql://localhost/default',
  local: 'postgresql://localhost/local',
  development: 'postgresql://localhost/development',
  production: 'postgresql://localhost/production',
  test: 'postgresql://localhost/test',
  shell: 'postgresql://localhost/shell',
};

test('Prisma loads database configuration with Next.js environment precedence', () => {
  const dir = mkdtempSync(join(tmpdir(), 'saiway-env-test-'));
  try {
    for (const [file, value] of [
      ['.env', urls.default],
      ['.env.local', urls.local],
      ['.env.development.local', urls.development],
      ['.env.production.local', urls.production],
      ['.env.test', urls.test],
    ]) writeFileSync(join(dir, file), `DATABASE_URL=${value}\n`);

    function load(nodeEnv, databaseUrl) {
      const env = { ...process.env, NODE_ENV: nodeEnv };
      delete env.DATABASE_URL;
      if (databaseUrl) env.DATABASE_URL = databaseUrl;
      return execFileSync(process.execPath, [
        '--input-type=module',
        '-e',
        `const config = (await import(${JSON.stringify(configUrl)})).default; process.stdout.write(config.datasource.url);`,
      ], { cwd: dir, env, encoding: 'utf8' });
    }

    assert.equal(load('development'), urls.development);
    assert.equal(load('production'), urls.production);
    assert.equal(load('test'), urls.test);
    assert.equal(load('production', urls.shell), urls.shell);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
