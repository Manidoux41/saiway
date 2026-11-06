import { test } from 'node:test';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { inflateSync } from 'node:zlib';
import { assert, base, createAccount, request, setup } from './helpers.mjs';

async function upload(cookie, endpoint, data, type) {
  const body = new FormData();
  body.set('file', new Blob([data], { type }), 'card-image');
  const response = await fetch(`${base}${endpoint}`, { method: 'PUT', body, headers: { Cookie: cookie }, signal: AbortSignal.timeout(30_000) });
  return response.status;
}

async function pdf(endpoint, cookie) {
  const response = await fetch(`${base}${endpoint}`, { headers: cookie ? { Cookie: cookie } : {}, signal: AbortSignal.timeout(30_000) });
  return { status: response.status, headers: response.headers, data: Buffer.from(await response.arrayBuffer()) };
}

function contentStreams(bytes) {
  const source = bytes.toString('latin1');
  return [...source.matchAll(/stream\n([\s\S]*?)\nendstream/g)].flatMap((match) => {
    try { return [inflateSync(Buffer.from(match[1], 'latin1')).toString('latin1')]; }
    catch { return []; }
  }).join('\n');
}

function assertCenteredPhotos(bytes, width, height) {
  const scale = 15 * 72 / 25.4 / Math.min(width, height);
  const drawnWidth = width * scale;
  const drawnHeight = height * scale;
  const x = 16.5 * 72 / 25.4 - drawnWidth / 2;
  const y = 26 * 72 / 25.4 + drawnHeight / 2;
  const matrices = [...contentStreams(bytes).matchAll(/([\d.]+) 0 0 (-[\d.]+) (-?[\d.]+) (-?[\d.]+) cm\n\/I\d+ Do/g)];
  const centered = matrices.filter((match) =>
    Math.abs(Number(match[1]) - drawnWidth) < 0.001 &&
    Math.abs(Number(match[2]) + drawnHeight) < 0.001 &&
    Math.abs(Number(match[3]) - x) < 0.001 &&
    Math.abs(Number(match[4]) - y) < 0.001);
  assert.equal(centered.length, 8, 'The photo is centered on both axes inside all eight circular frames');
}

test('administrators download eight copies on A4 with branded QR codes and paginated fleet sheets', async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, 'DRIVER', 'pdf-driver');
    const customer = await createAccount(ctx, 'CUSTOMER', 'pdf-customer');
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    const endpoint = `/api/admin/drivers/${driverId}/business-card?language=fr`;
    for (const cookie of [undefined, driver.cookie, customer.cookie]) {
      assert.equal((await pdf(endpoint, cookie)).status, 403);
      assert.equal((await pdf('/api/admin/business-cards', cookie)).status, 403);
    }
    assert.equal((await pdf(endpoint, ctx.cookie)).status, 422);
    assert.equal((await pdf('/api/admin/drivers/missing/business-card', ctx.cookie)).status, 404);
    assert.equal((await pdf(`/api/admin/drivers/${driverId}/business-card?language=invalid`, ctx.cookie)).status, 400);
    await ctx.prisma.user.update({ where: { id: driver.id }, data: { name: 'Sokha សុខា', phone: '+855 12 345 678' } });
    const qr = await QRCode.toBuffer('https://example.invalid/contact', { width: 400, margin: 4 });
    const telegramWebp = await sharp(qr).webp({ lossless: true }).toBuffer();
    const portrait = await sharp({ create: { width: 120, height: 180, channels: 3, background: '#032ea1' } }).jpeg().toBuffer();
    assert.equal(await upload(ctx.cookie, `/api/admin/drivers/${driverId}/photo`, portrait, 'image/jpeg'), 201);
    for (const [channel, bytes, type] of [['WHATSAPP', qr, 'image/png'], ['TELEGRAM', telegramWebp, 'image/webp']]) {
      assert.equal(await upload(ctx.cookie, `/api/drivers/${driverId}/contact-qr/${channel}`, bytes, type), 201);
    }
    const managed = (await request('/api/admin/management', 'GET', undefined, ctx.cookie)).data.users.find((user) => user.id === driver.id).driver;
    assert.equal(managed.contactQrImages.length, 2);
    const card = await pdf(endpoint, ctx.cookie);
    assert.equal(card.status, 200, card.data.toString('utf8').slice(0, 300));
    assert.equal(card.headers.get('content-type'), 'application/pdf');
    assert.match(card.headers.get('content-disposition'), /attachment; filename="saiway-business-card.pdf"/);
    assert.equal(Number(card.headers.get('content-length')), card.data.length);
    assert.match(card.headers.get('cache-control'), /private, no-store/);
    assert.equal(card.data.subarray(0, 5).toString(), '%PDF-');
    const source = card.data.toString('latin1');
    const box = source.match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/);
    assert.ok(box, 'PDF includes a physical page size');
    assert.ok(Math.abs(Number(box[1]) * 25.4 / 72 - 210) < 0.01);
    assert.ok(Math.abs(Number(box[2]) * 25.4 / 72 - 297) < 0.01);
    assert.equal([...source.matchAll(/\/Type \/Page\b/g)].length, 1);
    assert.ok([...source.matchAll(/\/Subtype \/Image\b/g)].length >= 3, 'Photo and both QR images are embedded');
    assertCenteredPhotos(card.data, 120, 180);
    const content = contentStreams(card.data);
    const translations = [...content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) cm/g)].map((match) => [Number(match[1]), Number(match[2])]);
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const x = (595.28 - 175 * 72 / 25.4) / 2 + col * 90 * 72 / 25.4;
        const y = (10 + row * 60) * 72 / 25.4;
        assert.equal(translations.filter(([left, top]) => Math.abs(left - x) < 0.01 && Math.abs(top - y) < 0.01).length, 1, `Card at column ${col + 1}, row ${row + 1}`);
        assert.ok(x + 85 * 72 / 25.4 < 595.28);
        assert.ok(y + 55 * 72 / 25.4 < 841.89);
      }
    }
    const logoScale = (2.5 * 72 / 25.4 / 24).toFixed(6);
    assert.equal(content.split(`${logoScale} 0 0 ${logoScale} 0 0 cm`).length - 1, 24, 'Three service logos per card, eight cards');

    const passwordHash = (await ctx.prisma.user.findUniqueOrThrow({ where: { id: ctx.id } })).passwordHash;
    for (let i = 0; i < 8; i += 1) await ctx.prisma.user.create({ data: {
      email: `${ctx.prefix}-sheet-${i}@example.invalid`, name: `Sheet driver ${i}`,
      passwordHash, role: 'DRIVER', phone: '+855 12 345 678', driver: { create: {} },
    } });
    const management = await request('/api/admin/management', 'GET', undefined, ctx.cookie);
    const count = management.data.users.filter((user) => user.role === 'DRIVER' && user.driver && user.phone?.trim()).length;
    const sheet = await pdf('/api/admin/business-cards?language=en', ctx.cookie);
    assert.equal(sheet.status, 200, sheet.data.toString('utf8').slice(0, 300));
    assert.match(sheet.headers.get('content-disposition'), /saiway-business-cards-a4.pdf/);
    const sheetSource = sheet.data.toString('latin1');
    assert.equal([...sheetSource.matchAll(/\/Type \/Page\b/g)].length, Math.ceil(count / 8));
    assert.match(sheetSource, /\/MediaBox \[0 0 595.28 841.89\]/);
    assert.equal(await ctx.prisma.auditLog.count({ where: { actorId: ctx.id, entityId: driverId, action: 'DOWNLOAD_BUSINESS_CARD_PDF' } }), 2);

    const landscape = await sharp({ create: { width: 180, height: 120, channels: 3, background: '#032ea1' } }).jpeg().toBuffer();
    assert.equal(await upload(ctx.cookie, `/api/admin/drivers/${driverId}/photo`, landscape, 'image/jpeg'), 201);
    const landscapeCard = await pdf(endpoint, ctx.cookie);
    assert.equal(landscapeCard.status, 200);
    assertCenteredPhotos(landscapeCard.data, 180, 120);

    await ctx.prisma.driverContactQrImage.update({ where: { driverId_channel: { driverId, channel: 'WHATSAPP' } }, data: { data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) } });
    const invalid = await pdf(endpoint, ctx.cookie);
    assert.equal(invalid.status, 422);
    assert.match(invalid.data.toString(), /Replace the image/);
  } finally { await ctx.cleanup(); }
});
