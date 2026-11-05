import { test } from 'node:test';
import { assert, base, createAccount, request, setup } from './helpers.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

async function imageRequest(cookie, driverId, channel, method = 'GET', bytes) {
  const body = bytes === undefined ? undefined : new FormData();
  body?.set('file', new Blob([bytes], { type: 'image/png' }), 'contact-qr.png');
  const response = await fetch(`${base}/api/drivers/${driverId}/contact-qr/${channel}`, {
    method, body, signal: AbortSignal.timeout(30_000),
    headers: cookie ? { Cookie: cookie } : {},
  });
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}

test('driver contact QR uploads persist independently, remain private and appear on admin cards', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER', 'qr-driver');
    const other = await createAccount(ctx, 'DRIVER', 'other-qr-driver');
    const customer = await createAccount(ctx, 'CUSTOMER', 'qr-customer');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;

    for (const cookie of [undefined, ctx.cookie, customer.cookie]) {
      assert.equal((await request('/api/driver/contact-qr', 'GET', undefined, cookie)).status, 403);
    }
    assert.deepEqual((await request('/api/driver/contact-qr', 'GET', undefined, driver.cookie)).data.driver, { id: driverId, contactQrImages: [] });

    for (const channel of ['WHATSAPP', 'TELEGRAM']) {
      for (const cookie of [undefined, other.cookie, customer.cookie]) {
        assert.equal((await imageRequest(cookie, driverId, channel, 'PUT', png)).status, 403);
        assert.equal((await imageRequest(cookie, driverId, channel)).status, 403);
        assert.equal((await imageRequest(cookie, driverId, channel, 'DELETE')).status, 403);
      }
      assert.equal((await imageRequest(driver.cookie, driverId, channel)).status, 404);
      assert.equal((await imageRequest(driver.cookie, driverId, channel, 'PUT', png)).status, 201);
      const own = await imageRequest(driver.cookie, driverId, channel);
      assert.equal(own.status, 200);
      assert.ok(own.bytes.equals(png));
      assert.equal(own.headers.get('content-type'), 'image/png');
      assert.match(own.headers.get('cache-control'), /private, no-store/);
      assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
      assert.equal((await imageRequest(ctx.cookie, driverId, channel)).status, 200);
    }
    assert.equal((await imageRequest(driver.cookie, driverId, 'SMS', 'PUT', png)).status, 404);
    assert.equal((await imageRequest(ctx.cookie, 'missing-driver', 'WHATSAPP', 'PUT', png)).status, 404);
    assert.equal((await imageRequest(driver.cookie, driverId, 'WHATSAPP', 'PUT', Buffer.from('<svg onload=alert(1)>'))).status, 415);
    assert.equal((await imageRequest(driver.cookie, driverId, 'WHATSAPP', 'PUT', Buffer.alloc(0))).status, 413);
    assert.equal((await imageRequest(driver.cookie, driverId, 'WHATSAPP', 'PUT', Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]))).status, 413);
    assert.equal((await imageRequest(driver.cookie, driverId, 'WHATSAPP', 'PUT')).status, 400);

    const old = await ctx.prisma.driverContactQrImage.findUniqueOrThrow({ where: { driverId_channel: { driverId, channel: 'WHATSAPP' } } });
    const replacement = Buffer.concat([png, Buffer.from('replacement')]);
    assert.equal((await imageRequest(driver.cookie, driverId, 'WHATSAPP', 'PUT', replacement)).status, 201);
    assert.ok((await imageRequest(driver.cookie, driverId, 'WHATSAPP')).bytes.equals(replacement));
    assert.ok((await imageRequest(driver.cookie, driverId, 'TELEGRAM')).bytes.equals(png));
    assert.equal(await ctx.prisma.driverContactQrImage.count({ where: { driverId } }), 2);
    const updated = await ctx.prisma.driverContactQrImage.findUniqueOrThrow({ where: { id: old.id } });
    assert.ok(updated.uploadedAt.getTime() > old.uploadedAt.getTime());

    const summary = (await request('/api/driver/contact-qr', 'GET', undefined, driver.cookie)).data.driver;
    const managed = (await request('/api/admin/management', 'GET', undefined, ctx.cookie)).data.users.find((user) => user.id === driver.id).driver;
    assert.deepEqual(managed.contactQrImages, summary.contactQrImages);
    assert.deepEqual(summary.contactQrImages.map((image) => Object.keys(image).sort()), [
      ['channel', 'uploadedAt'], ['channel', 'uploadedAt'],
    ]);
    assert.equal((await request('/api/driver/contact-qr', 'GET', undefined, other.cookie)).data.driver.contactQrImages.length, 0);

    assert.equal((await imageRequest(driver.cookie, driverId, 'WHATSAPP', 'DELETE')).status, 200);
    assert.equal((await imageRequest(driver.cookie, driverId, 'WHATSAPP')).status, 404);
    assert.ok((await imageRequest(driver.cookie, driverId, 'TELEGRAM')).bytes.equals(png));
    assert.equal((await imageRequest(ctx.cookie, driverId, 'TELEGRAM', 'PUT', replacement)).status, 201);
    assert.equal((await imageRequest(ctx.cookie, driverId, 'TELEGRAM', 'DELETE')).status, 200);
    assert.equal((await imageRequest(driver.cookie, driverId, 'TELEGRAM', 'DELETE')).status, 404);
    assert.equal(await ctx.prisma.driverContactQrImage.count({ where: { driverId } }), 0);
    assert.equal(await ctx.prisma.auditLog.count({ where: { actorId: driver.id, entity: 'DriverContactQrImage', action: 'UPLOAD' } }), 3);
  } finally { await ctx.cleanup(); }
});
