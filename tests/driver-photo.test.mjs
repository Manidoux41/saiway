import { test } from 'node:test';
import { assert, setup, createAccount, request, base } from './helpers.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function call(cookie, driverId, method, bytes, type = 'image/png') {
  const init = { method, signal: AbortSignal.timeout(30_000), headers: cookie ? { Cookie: cookie } : {} };
  if (bytes) { const body = new FormData(); body.set('file', new Blob([bytes], { type }), 'photo'); init.body = body; }
  const response = await fetch(`${base}/api/admin/drivers/${driverId}/photo`, init);
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}

test('administrators manage driver photos used on business cards', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER', 'driver');
    const customer = await createAccount(ctx, 'CUSTOMER', 'customer');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;

    for (const cookie of [undefined, customer.cookie, driver.cookie]) {
      assert.equal((await call(cookie, driverId, 'PUT', png)).status, 403);
      assert.equal((await call(cookie, driverId, 'GET')).status, 403);
    }
    assert.equal((await call(ctx.cookie, driverId, 'GET')).status, 404);
    assert.equal((await call(ctx.cookie, driverId, 'PUT', Buffer.from('<svg onload=alert(1)>'))).status, 415);
    assert.equal((await call(ctx.cookie, 'missing-driver', 'PUT', png)).status, 404);
    assert.equal((await call(ctx.cookie, driverId, 'PUT', Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]))).status, 413);

    assert.equal((await call(ctx.cookie, driverId, 'PUT', png)).status, 201);
    const photo = await call(ctx.cookie, driverId, 'GET');
    assert.equal(photo.status, 200);
    assert.ok(photo.bytes.equals(png));
    assert.equal(photo.headers.get('content-type'), 'image/png');
    assert.equal(photo.headers.get('x-content-type-options'), 'nosniff');

    const listed = (await request('/api/admin/management', 'GET', undefined, ctx.cookie)).data.users.find((item) => item.id === driver.id).driver;
    assert.ok(listed.photo.uploadedAt);
    assert.equal(listed.photo.data, undefined);

    assert.equal((await call(ctx.cookie, driverId, 'DELETE')).status, 200);
    assert.equal((await call(ctx.cookie, driverId, 'GET')).status, 404);
    assert.equal(await ctx.prisma.driverPhoto.count({ where: { driverId } }), 0);
  } finally { await ctx.cleanup(); }
});
