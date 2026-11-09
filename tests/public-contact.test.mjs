import { test } from "node:test";
import { assert, base, createAccount, request, setup } from "./helpers.mjs";
import { contactSettingKey, defaultContactEmail, defaultContactDriverName } from "../lib/contact-settings.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");

test("contact page publishes only configured driver QR codes and audited admin settings", async () => {
  const dbUrl = new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(dbUrl.hostname), "Use an isolated local database");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  const ctx = await setup();
  const original = await ctx.prisma.systemSetting.findUnique({ where: { key: contactSettingKey } });
  const save = (email, driverId, cookie = ctx.cookie) => request("/api/admin/management", "POST", { entity: "setting", data: { key: contactSettingKey, value: { email, driverId } } }, cookie);
  const qr = (channel = "WHATSAPP") => fetch(`${base}/api/contact/qr/${channel}`, { signal: AbortSignal.timeout(30000) });
  try {
    await ctx.prisma.systemSetting.deleteMany({ where: { key: contactSettingKey } });
    const driver = await createAccount(ctx, "DRIVER", "public-driver");
    const other = await createAccount(ctx, "DRIVER", "private-driver");
    const customer = await createAccount(ctx, "CUSTOMER");
    await ctx.prisma.user.update({ where: { id: driver.id }, data: { name: defaultContactDriverName } });
    const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } });
    const otherProfile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: other.id } });
    for (const channel of ["WHATSAPP", "TELEGRAM"]) await ctx.prisma.driverContactQrImage.create({ data: { driverId: profile.id, channel, mimeType: "image/png", sizeBytes: png.length, data: png } });

    const page = await fetch(`${base}/contact`);
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.ok(html.includes(defaultContactDriverName));
    assert.ok(html.includes(`mailto:${defaultContactEmail}`));
    assert.ok(!html.includes(driver.email), "Private account email is never public");
    for (const channel of ["WHATSAPP", "TELEGRAM"]) {
      const response = await qr(channel);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.ok(Buffer.from(await response.arrayBuffer()).equals(png));
    }
    assert.equal((await qr("FRONT")).status, 404);
    assert.equal((await fetch(`${base}/api/drivers/${profile.id}/contact-qr/WHATSAPP`)).status, 403);
    assert.equal((await request("/api/admin/management", "POST", { entity: "setting", data: { key: contactSettingKey, value: { email: "contact@example.invalid", driverId: profile.id } } })).status, 403);
    for (const cookie of [driver.cookie, customer.cookie]) assert.equal((await save("contact@example.invalid", profile.id, cookie)).status, 403);
    assert.equal((await save("invalid", profile.id)).status, 400);
    assert.equal((await save("contact@example.invalid", "missing")).status, 400);
    assert.equal((await save("contact@example.invalid", otherProfile.id)).status, 201);
    assert.deepEqual(JSON.parse((await ctx.prisma.systemSetting.findUniqueOrThrow({ where: { key: contactSettingKey } })).value), { email: "contact@example.invalid", driverId: otherProfile.id });
    assert.deepEqual((await request("/api/admin/management", "GET", undefined, ctx.cookie)).data.contact, { email: "contact@example.invalid", driverId: otherProfile.id });
    assert.equal((await qr()).status, 404, "Changing driver immediately stops exposing previous QR");
    assert.ok((await (await fetch(`${base}/contact`)).text()).includes("mailto:contact@example.invalid"));
    assert.equal((await save("contact@example.invalid", null)).status, 201);
    assert.equal((await qr()).status, 404);
    assert.equal((await save("contact@example.invalid", profile.id)).status, 201);
    await ctx.prisma.user.update({ where: { id: driver.id }, data: { status: "SUSPENDED" } });
    assert.equal((await qr()).status, 404, "Suspended driver QR is not published");
    assert.equal((await save("contact@example.invalid", profile.id)).status, 400);
    assert.equal(await ctx.prisma.auditLog.count({ where: { actorId: ctx.id, entity: "setting", entityId: contactSettingKey } }), 3);
  } finally {
    try {
      if (original) await ctx.prisma.systemSetting.upsert({ where: { key: original.key }, create: original, update: { value: original.value } });
      else await ctx.prisma.systemSetting.deleteMany({ where: { key: contactSettingKey } });
    } finally { await ctx.cleanup(); }
  }
});
