import { test } from 'node:test';
import { assert, request, setup, createAccount, base } from './helpers.mjs';

const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

async function upload(cookie, side, bytes, type = 'image/png') {
  const body = new FormData();
  body.set('side', side);
  body.set('file', new Blob([bytes], { type }), 'licence');
  const response = await fetch(`${base}/api/driver/license`, { method: 'POST', body, signal: AbortSignal.timeout(30_000), headers: cookie ? { Cookie: cookie } : {} });
  return { status: response.status, data: await response.json() };
}

async function image(cookie, driverId, side) {
  const response = await fetch(`${base}/api/drivers/${driverId}/license/${side}`, { signal: AbortSignal.timeout(30_000), headers: cookie ? { Cookie: cookie } : {} });
  return { status: response.status, headers: response.headers, bytes: Buffer.from(await response.arrayBuffer()) };
}

test('driver licence photos are stored privately and visible only to the driver and administrators', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER', 'driver');
    const otherDriver = await createAccount(ctx, 'DRIVER', 'other-driver');
    const customer = await createAccount(ctx, 'CUSTOMER', 'customer');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;

    assert.equal((await upload(undefined, 'FRONT', png)).status, 403);
    assert.equal((await upload(customer.cookie, 'FRONT', png)).status, 403);
    assert.equal((await upload(ctx.cookie, 'FRONT', png)).status, 403);
    assert.equal((await upload(driver.cookie, 'SIDE', png)).status, 400);
    assert.equal((await upload(driver.cookie, 'FRONT', Buffer.from('<svg onload=alert(1)>'), 'image/png')).status, 415);
    assert.equal((await upload(driver.cookie, 'FRONT', Buffer.concat([png, Buffer.alloc(5 * 1024 * 1024)]))).status, 413);
    assert.equal(await ctx.prisma.driverLicenseImage.count({ where: { driverId } }), 0);

    const front = await upload(driver.cookie, 'FRONT', png);
    assert.equal(front.status, 201);
    assert.deepEqual({ side: front.data.image.side, mimeType: front.data.image.mimeType, sizeBytes: front.data.image.sizeBytes }, { side: 'FRONT', mimeType: 'image/png', sizeBytes: png.length });
    assert.equal(front.data.image.data, undefined);
    assert.equal((await upload(driver.cookie, 'BACK', jpeg, 'image/jpeg')).status, 201);

    const own = await image(driver.cookie, driverId, 'FRONT');
    assert.equal(own.status, 200);
    assert.ok(own.bytes.equals(png));
    assert.equal(own.headers.get('content-type'), 'image/png');
    assert.match(own.headers.get('cache-control'), /no-store/);
    assert.equal(own.headers.get('x-content-type-options'), 'nosniff');
    for (const cookie of [undefined, customer.cookie, otherDriver.cookie]) assert.equal((await image(cookie, driverId, 'FRONT')).status, 403);
    assert.equal((await image(driver.cookie, driverId, 'LEFT')).status, 404);

    const admin = await image(ctx.cookie, driverId, 'BACK');
    assert.equal(admin.status, 200);
    assert.ok(admin.bytes.equals(jpeg));
    assert.equal(admin.headers.get('content-type'), 'image/jpeg');
    assert.equal(await ctx.prisma.auditLog.count({ where: { actorId: ctx.id, entity: 'DriverLicenseImage', action: 'VIEW' } }), 1);
    assert.equal(await ctx.prisma.auditLog.count({ where: { actorId: driver.id, entity: 'DriverLicenseImage', action: { startsWith: 'UPLOAD_' } } }), 2);

    assert.equal((await upload(driver.cookie, 'FRONT', jpeg, 'image/jpeg')).status, 201);
    const stored = await ctx.prisma.driverLicenseImage.findMany({ where: { driverId }, orderBy: { side: 'asc' } });
    assert.deepEqual(stored.map((item) => [item.side, item.mimeType]), [['FRONT', 'image/jpeg'], ['BACK', 'image/jpeg']]);

    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'user', id: driver.id, data: { licenseNo: 'KH-123456', licenseExpiresAt: '2030-05-31' } }, ctx.cookie)).status, 200);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'user', id: customer.id, data: { licenseExpiresAt: '2030-05-31' } }, ctx.cookie)).status, 400);
    assert.equal((await request('/api/admin/management', 'PATCH', { entity: 'user', id: driver.id, data: { licenseExpiresAt: '31/05/2030' } }, ctx.cookie)).status, 400);
    const summary = await request('/api/driver/license', 'GET', undefined, driver.cookie);
    assert.equal(summary.status, 200);
    assert.equal(summary.data.license.licenseNo, 'KH-123456');
    assert.equal(summary.data.license.licenseExpiresAt, '2030-05-31T00:00:00.000Z');
    assert.deepEqual(summary.data.license.licenseImages.map((item) => item.side), ['FRONT', 'BACK']);
    assert.equal((await request('/api/driver/license', 'GET', undefined, customer.cookie)).status, 403);

    const management = await request('/api/admin/management', 'GET', undefined, ctx.cookie);
    const listed = management.data.users.find((item) => item.id === driver.id).driver;
    assert.equal(listed.licenseNo, 'KH-123456');
    assert.equal(listed.licenseImages.length, 2);
    assert.ok(listed.licenseImages.every((item) => item.data === undefined));
  } finally { await ctx.cleanup(); }
});

test('only the assigned driver receives the passenger contact phone', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER', 'driver');
    const otherDriver = await createAccount(ctx, 'DRIVER', 'other-driver');
    const customer = await createAccount(ctx, 'CUSTOMER', 'customer');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    const body = { fromAddress: 'SAI Airport', toAddress: 'Validation hotel', direction: 'AIRPORT_TO_CITY', tripType: 'PRIVATE_TRANSFER', pickupAt: new Date(Date.now() + 86400000).toISOString(), passengers: 2, paymentMethod: 'DRIVER' };
    assert.equal((await request('/api/bookings', 'POST', { ...body, contactPhone: 'javascript:alert(1)' }, customer.cookie)).status, 400);
    const created = await request('/api/bookings', 'POST', { ...body, contactPhone: '+855 12 345 678' }, customer.cookie);
    assert.equal(created.status, 201);
    assert.equal(created.data.booking.contactPhone, '+855 12 345 678');
    const id = created.data.booking.id;
    assert.equal((await request('/api/admin/bookings', 'PATCH', { id, driverId }, ctx.cookie)).status, 200);
    const assigned = (await request('/api/driver/bookings', 'GET', undefined, driver.cookie)).data.bookings.find((item) => item.id === id);
    assert.equal(assigned.contactPhone, '+855 12 345 678');
    assert.ok('phone' in assigned.customer);
    assert.ok(!(await request('/api/driver/bookings', 'GET', undefined, otherDriver.cookie)).data.bookings.some((item) => item.id === id));
  } finally { await ctx.cleanup(); }
});
