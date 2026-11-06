import { test } from 'node:test';
import { assert, request, setup, createAccount, base } from './helpers.mjs';
import { gpsRetentionSettingKey } from '../lib/cron-settings.ts';

test('admin can persistently pause and resume scheduled retention without exposing its secret', async () => {
  const url = new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Run retention tests only on an isolated local database');
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname));
  assert.ok(process.env.CRON_SECRET, 'Configure a test cron secret');
  const ctx = await setup();
  const original = await ctx.prisma.systemSetting.findUnique({ where: { key: gpsRetentionSettingKey } });
  const toggle = value => ({ entity: 'setting', data: { key: gpsRetentionSettingKey, value } });
  const runCron = async secret => {
    const response = await fetch(`${base}/api/cron/driver-location-retention`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    const driver = await createAccount(ctx, 'DRIVER');
    const customer = await createAccount(ctx, 'CUSTOMER');
    const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } });
    const old = await ctx.prisma.driverLocation.create({ data: { driverId: profile.id, latitude: 13.36, longitude: 103.85, recordedAt: new Date(Date.now() - 31 * 86400000) } });
    const recent = await ctx.prisma.driverLocation.create({ data: { driverId: profile.id, latitude: 13.37, longitude: 103.86 } });

    assert.equal((await request('/api/admin/management', 'POST', toggle(false))).status, 403);
    for (const cookie of [driver.cookie, customer.cookie]) {
      assert.equal((await request('/api/admin/management', 'POST', toggle(false), cookie)).status, 403);
    }
    assert.equal((await request('/api/admin/management', 'POST', toggle('false'), ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/management', 'POST', toggle(false), ctx.cookie)).status, 201);
    assert.equal((await ctx.prisma.systemSetting.findUniqueOrThrow({ where: { key: gpsRetentionSettingKey } })).value, 'false');
    const listing = await request('/api/admin/management', 'GET', undefined, ctx.cookie);
    assert.equal(listing.status, 200);
    assert.deepEqual(listing.data.cron, { gpsRetentionEnabled: false, configured: true });
    assert.ok(!JSON.stringify(listing.data).includes(process.env.CRON_SECRET));
    assert.equal((await runCron('invalid')).status, 401);
    const skipped = await runCron(process.env.CRON_SECRET);
    assert.equal(skipped.status, 200);
    assert.deepEqual(skipped.data, { skipped: true, reason: 'DISABLED', removed: 0 });
    assert.ok(await ctx.prisma.driverLocation.findUnique({ where: { id: old.id } }));

    assert.equal((await request('/api/admin/management', 'POST', toggle(true), ctx.cookie)).status, 201);
    const executed = await runCron(process.env.CRON_SECRET);
    assert.equal(executed.status, 200);
    assert.equal(executed.data.skipped, false);
    assert.ok(executed.data.removed >= 1);
    assert.equal(await ctx.prisma.driverLocation.findUnique({ where: { id: old.id } }), null);
    assert.ok(await ctx.prisma.driverLocation.findUnique({ where: { id: recent.id } }));
    const audit = await ctx.prisma.auditLog.findMany({ where: { actorId: ctx.id, entity: 'setting', entityId: gpsRetentionSettingKey }, orderBy: { createdAt: 'asc' } });
    assert.deepEqual(audit.map(row => row.metadata), [{ enabled: false }, { enabled: true }]);
  } finally {
    try {
      if (original) await ctx.prisma.systemSetting.upsert({ where: { key: original.key }, create: original, update: { value: original.value } });
      else await ctx.prisma.systemSetting.deleteMany({ where: { key: gpsRetentionSettingKey } });
    } finally { await ctx.cleanup(); }
  }
});
