import { test } from "node:test";
import sharp from "sharp";
import { assert, base, createAccount, request, setup } from "./helpers.mjs";

test("blog gallery uploads, replacements and captions persist with draft privacy and safe image output", async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL).hostname));
  const ctx = await setup();
  const ids = [];
  try {
    const driver = await createAccount(ctx, "DRIVER");
    const input = { title: `${ctx.prefix} gallery`, excerpt: "Photo story", content: "Travel notes", language: "en", published: false, featured: false, bookingId: null };
    let post = (await request("/api/admin/blog", "POST", input, ctx.cookie)).data.post;
    const other = (await request("/api/admin/blog", "POST", { ...input, title: `${ctx.prefix} other` }, ctx.cookie)).data.post;
    ids.push(post.id, other.id);
    const png = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: "green" } }).png().toBuffer();
    const upload = async (path, method, bytes = png, cookie = ctx.cookie) => {
      const body = new FormData();
      body.set("file", new Blob([bytes], { type: "image/png" }), "tour.png");
      const response = await fetch(`${base}${path}`, { method, body, headers: cookie ? { Cookie: cookie } : {} });
      return { status: response.status, data: await response.json() };
    };
    assert.equal((await upload(`/api/admin/blog/${post.id}/photos`, "POST", png, driver.cookie)).status, 403);
    assert.equal((await upload(`/api/admin/blog/${post.id}/photos`, "POST", Buffer.from("<svg onload='alert(1)'/>"))).status, 415);
    assert.equal((await upload(`/api/admin/blog/${post.id}/photos`, "POST", Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    assert.equal((await upload(`/api/admin/blog/${post.id}/photos`, "POST", Buffer.from([137,80,78,71,13,10,26,10]))).status, 415);
    const uploaded = await upload(`/api/admin/blog/${post.id}/photos`, "POST");
    assert.equal(uploaded.status, 201);
    post = uploaded.data.post;
    const photoId = post.photos[0].id;
    const publicUrl = `/api/blog/photos/${photoId}`;
    assert.equal((await fetch(`${base}${publicUrl}`)).status, 404);
    assert.equal((await fetch(`${base}${publicUrl}?preview=true`)).status, 403);
    const preview = await fetch(`${base}${publicUrl}?preview=true`, { headers: { Cookie: ctx.cookie } });
    assert.equal(preview.status, 200);
    assert.equal(preview.headers.get("content-type"), "image/webp");
    const metadata = await sharp(Buffer.from(await preview.arrayBuffer())).metadata();
    assert.equal(metadata.width, 2000);
    assert.equal(metadata.height, 1000);
    assert.equal(metadata.exif, undefined);
    assert.equal((await request(`/api/admin/blog/${other.id}/photos/${photoId}`, "DELETE", undefined, ctx.cookie)).status, 409);
    const caption = "Countryside near Siem Reap";
    post = (await request(`/api/admin/blog/${post.id}/photos/${photoId}`, "PATCH", { caption }, ctx.cookie)).data.post;
    assert.equal(post.photos[0].caption, caption);
    const before = post.photos[0].updatedAt;
    const replacement = await sharp({ create: { width: 64, height: 128, channels: 3, background: "blue" } }).png().toBuffer();
    post = (await upload(`/api/admin/blog/${post.id}/photos/${photoId}`, "PUT", replacement)).data.post;
    assert.equal(post.photos[0].id, photoId);
    assert.equal(post.photos[0].caption, caption);
    assert.notEqual(post.photos[0].updatedAt, before);
    post = (await request(`/api/admin/blog/${post.id}`, "PATCH", { ...input, published: true, featured: true, expectedUpdatedAt: post.updatedAt }, ctx.cookie)).data.post;
    const image = await fetch(`${base}${publicUrl}`);
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("cache-control"), "no-store");
    assert.equal(image.headers.get("x-content-type-options"), "nosniff");
    assert.equal((await sharp(Buffer.from(await image.arrayBuffer())).metadata()).height, 128);
    assert.ok((await (await fetch(`${base}/blog/${post.id}`)).text()).includes(caption));
    post = (await request(`/api/admin/blog/${post.id}/photos/${photoId}`, "DELETE", undefined, ctx.cookie)).data.post;
    assert.equal(post.photos.length, 0);
    assert.equal((await fetch(`${base}${publicUrl}`)).status, 404);
    post = (await upload(`/api/admin/blog/${post.id}/photos`, "POST", replacement)).data.post;
    assert.equal((await request(`/api/admin/blog/${post.id}`, "DELETE", { expectedUpdatedAt: post.updatedAt }, ctx.cookie)).status, 200);
    assert.equal(await ctx.prisma.blogPhoto.count({ where: { postId: post.id } }), 0);
    assert.equal((await fetch(`${base}/api/blog/photos/${post.photos[0].id}`)).status, 404);
  } finally {
    await ctx.prisma.blogPost.deleteMany({ where: { id: { in: ids } } });
    await ctx.cleanup();
  }
});
