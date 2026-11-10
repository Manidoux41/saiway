import test from "node:test";
import sharp from "sharp";
import { assert, request, setup, createAccount, base } from "./helpers.mjs";

test("advertising image and PDF lifecycle protects drafts, validates uploads and revokes archived assets", async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, "CUSTOMER");
    const input = {
      advertiser: ctx.prefix, contactName: "Private", contactEmail: "", contactPhone: "",
      title: "ទេសចរណ៍នៅសៀមរាប", description: "Explore Cambodia", targetUrl: "https://example.com", placements: ["HOME"],
      status: "DRAFT", startsAt: new Date(Date.now() - 3600000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(),
      amountCents: 20000, priority: 0, notes: "PRIVATE NOTES", terms: "Private terms\n".repeat(150),
    };
    const created = await request("/api/admin/advertising", "POST", input, ctx.cookie);
    assert.equal(created.status, 201);
    let contract = created.data.contract;
    const path = `/api/admin/advertising/${contract.id}`;
    const imagePath = `/api/advertising/${contract.id}/image`;
    const image = await sharp({ create: { width: 1500, height: 900, channels: 3, background: "#032ea1" } }).png().toBuffer();
    async function upload(bytes, cookie = ctx.cookie, version = contract.updatedAt, name = "image.png") {
      const form = new FormData();
      form.set("file", new File([bytes], name, { type: "image/png" }));
      return fetch(`${base}${path}/image?expectedUpdatedAt=${encodeURIComponent(version)}`, { method: "PUT", headers: cookie ? { cookie } : {}, body: form });
    }
    for (const cookie of [undefined, customer.cookie]) {
      assert.equal((await upload(image, cookie === undefined ? "" : cookie)).status, 403);
      assert.equal((await request(`${path}/image`, "DELETE", { expectedUpdatedAt: contract.updatedAt }, cookie)).status, 403);
      assert.equal((await fetch(`${base}${imagePath}?preview=true`, { headers: cookie ? { cookie } : {} })).status, 403);
    }
    assert.equal((await upload(Buffer.from("invalid"))).status, 415);
    assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    const uploaded = await upload(image);
    assert.equal(uploaded.status, 200);
    contract = (await uploaded.json()).contract;
    assert.ok(contract.image);
    assert.equal((await upload(image, ctx.cookie, created.data.contract.updatedAt)).status, 409);
    assert.equal((await fetch(`${base}${imagePath}`)).status, 404);
    const preview = await fetch(`${base}${imagePath}?preview=true`, { headers: { cookie: ctx.cookie } });
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("cache-control"), "no-store");
    const metadata = await sharp(Buffer.from(await preview.arrayBuffer())).metadata();
    assert.equal(metadata.format, "webp");
    assert.ok(metadata.width <= 1200 && metadata.height <= 800);
    for (const language of ["en", "fr", "km"]) {
      const pdf = await fetch(`${base}${path}/pdf?language=${language}`, { headers: { cookie: ctx.cookie } });
      assert.equal(pdf.status, 200);
      assert.equal(pdf.headers.get("content-type"), "application/pdf");
      assert.equal(pdf.headers.get("cache-control"), "no-store");
      const bytes = Buffer.from(await pdf.arrayBuffer());
      assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
      assert.ok(bytes.length > 15000);
      assert.match(pdf.headers.get("content-disposition"), /SAIWAY-AD-/);
    }
    const enabled = await request(path, "PATCH", { ...input, status: "ACTIVE", expectedUpdatedAt: contract.updatedAt }, ctx.cookie);
    assert.equal(enabled.status, 200);
    contract = enabled.data.contract;
    assert.equal((await fetch(`${base}${imagePath}`)).status, 200);
    const removed = await request(`${path}/image`, "DELETE", { expectedUpdatedAt: contract.updatedAt }, ctx.cookie);
    assert.equal(removed.status, 200);
    contract = removed.data.contract;
    assert.equal(contract.image, null);
    assert.equal((await fetch(`${base}${imagePath}`)).status, 404);
    const again = await upload(image);
    assert.equal(again.status, 200);
    contract = (await again.json()).contract;
    assert.equal((await request(path, "DELETE", { expectedUpdatedAt: contract.updatedAt, reason: "Campaign ended" }, ctx.cookie)).status, 200);
    assert.equal((await fetch(`${base}${imagePath}`)).status, 404);
    assert.equal((await fetch(`${base}${imagePath}?preview=true`, { headers: { cookie: ctx.cookie } })).status, 404);
    assert.equal((await fetch(`${base}${path}/pdf`, { headers: { cookie: ctx.cookie } })).status, 404);
    const logs = await ctx.prisma.auditLog.findMany({ where: { entityId: contract.id } });
    assert.equal(logs.filter((log) => log.action === "UPLOAD_IMAGE").length, 2);
    assert.equal(logs.filter((log) => log.action === "DELETE_IMAGE").length, 1);
  } finally {
    await ctx.prisma.advertisingContract.deleteMany({ where: { advertiser: { startsWith: ctx.prefix } } });
    await ctx.cleanup();
  }
});
