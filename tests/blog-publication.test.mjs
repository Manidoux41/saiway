import { test } from "node:test";
import { assert, base, createAccount, request, setup } from "./helpers.mjs";

test("admin tourism article CRUD protects drafts, trip privacy and homepage editorial choices", async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL).hostname));
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  const ctx = await setup();
  const ids = [];
  try {
    const customer = await createAccount(ctx, "CUSTOMER");
    const driver = await createAccount(ctx, "DRIVER");
    const trip = await ctx.prisma.booking.create({ data: {
      reference: `${ctx.prefix}-PRIVATE-TRIP`, customerId: customer.id, fromAddress: "Private pickup address", toAddress: "Private hotel",
      status: "TRIP_COMPLETED", direction: "AIRPORT_TO_CITY", tripType: "AIRPORT_TRANSFER", pickupAt: new Date(), priceCents: 3000, passengers: 2,
      adminArchivedAt: new Date(),
    } });
    const input = { title: `${ctx.prefix} Angkor at sunrise`, excerpt: "Local tips for a pleasant visit", content: "Bring water.\nRespect temple dress rules.\n<script>alert('not-html')</script>", language: "fr", published: false, featured: true, bookingId: trip.id };
    for (const cookie of [undefined, customer.cookie, driver.cookie]) {
      assert.equal((await request("/api/admin/blog", "GET", undefined, cookie)).status, 403);
      assert.equal((await request("/api/admin/blog", "POST", input, cookie)).status, 403);
    }
    assert.equal((await request("/api/admin/blog?page=bad", "GET", undefined, ctx.cookie)).status, 400);
    assert.equal((await request("/api/admin/blog", "POST", { ...input, title: " " }, ctx.cookie)).status, 400);
    assert.equal((await request("/api/admin/blog", "POST", { ...input, language: "xx" }, ctx.cookie)).status, 400);
    assert.equal((await request("/api/admin/blog", "POST", { ...input, bookingId: "missing" }, ctx.cookie)).status, 400);
    const unfinished = await ctx.prisma.booking.create({ data: {
      reference: `${ctx.prefix}-UNFINISHED`, customerId: customer.id, fromAddress: trip.fromAddress, toAddress: trip.toAddress,
      status: "CONFIRMED", direction: "AIRPORT_TO_CITY", tripType: "AIRPORT_TRANSFER", pickupAt: new Date(), priceCents: 3000, passengers: 2,
    } });
    assert.equal((await request("/api/admin/blog", "POST", { ...input, bookingId: unfinished.id }, ctx.cookie)).status, 400);
    const created = await request("/api/admin/blog", "POST", input, ctx.cookie);
    assert.equal(created.status, 201);
    let post = created.data.post;
    ids.push(post.id);
    assert.equal(post.publishedAt, null);
    assert.equal((await fetch(`${base}/blog/${post.id}`)).status, 404);
    assert.ok(!(await (await fetch(`${base}/blog`)).text()).includes(input.title));
    assert.ok(!(await (await fetch(base)).text()).includes(input.title), "Featured draft must not appear on homepage");
    const listing = await request("/api/admin/blog", "GET", undefined, ctx.cookie);
    assert.ok(listing.data.trips.some(item => item.id === trip.id), "Archived completed trips can be linked internally");
    assert.equal(listing.data.posts.find(item => item.id === post.id).booking.reference, trip.reference);
    const update = (changes, version = post.updatedAt, cookie = ctx.cookie) => request(`/api/admin/blog/${post.id}`, "PATCH", { ...input, ...changes, expectedUpdatedAt: version }, cookie);
    for (const cookie of [undefined, customer.cookie, driver.cookie]) {
      assert.equal((await update({ published: true }, post.updatedAt, cookie ?? null)).status, 403);
      assert.equal((await request(`/api/admin/blog/${post.id}`, "DELETE", { expectedUpdatedAt: post.updatedAt }, cookie)).status, 403);
    }
    const published = await update({ published: true });
    assert.equal(published.status, 200);
    const oldVersion = post.updatedAt;
    post = published.data.post;
    assert.ok(post.publishedAt);
    assert.equal((await update({ title: "stale edit" }, oldVersion)).status, 409);
    const publicPage = await fetch(`${base}/blog/${post.id}`);
    assert.equal(publicPage.status, 200);
    const html = await publicPage.text();
    assert.ok(html.includes(input.title));
    assert.ok(html.includes("&lt;script&gt;"), "Article text is escaped rather than injected as HTML");
    for (const privateValue of [trip.reference, trip.fromAddress, trip.toAddress, customer.email, trip.id]) assert.ok(!html.includes(privateValue), `Must not publish ${privateValue}`);
    assert.ok((await (await fetch(`${base}/blog`)).text()).includes(input.title));
    assert.ok((await (await fetch(base)).text()).includes(input.title));
    post = (await update({ published: true, featured: false })).data.post;
    assert.ok(!(await (await fetch(base)).text()).includes(input.title));
    assert.ok((await (await fetch(`${base}/blog`)).text()).includes(input.title));
    post = (await update({ published: false })).data.post;
    assert.equal((await fetch(`${base}/blog/${post.id}`)).status, 404);
    assert.equal((await request(`/api/admin/blog/${post.id}`, "DELETE", { expectedUpdatedAt: oldVersion }, ctx.cookie)).status, 409);
    assert.equal((await request(`/api/admin/blog/${post.id}`, "DELETE", { expectedUpdatedAt: post.updatedAt }, ctx.cookie)).status, 200);
    assert.equal(await ctx.prisma.blogPost.findUnique({ where: { id: post.id } }), null);
    assert.ok(await ctx.prisma.booking.findUnique({ where: { id: trip.id } }));
    assert.ok(await ctx.prisma.auditLog.findFirst({ where: { actorId: ctx.id, entityId: post.id, action: "DELETE" } }));
  } finally {
    await ctx.prisma.blogPost.deleteMany({ where: { id: { in: ids } } });
    await ctx.cleanup();
  }
});

test("blog paginates public and admin lists and limits homepage features to three published stories", async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL).hostname));
  const ctx = await setup();
  const title = index => `${ctx.prefix} story ${String(index).padStart(2, "0")}.`;
  try {
    await ctx.prisma.blogPost.createMany({ data: Array.from({ length: 25 }, (_, index) => ({
      title: title(index), excerpt: "Travel advice", content: "Local sights", language: "en", published: index < 24, featured: true,
      publishedAt: new Date(Date.now() + 86400000 + index * 1000), createdAt: new Date(Date.now() + 86400000 + index * 1000),
    })) });
    const first = await request("/api/admin/blog", "GET", undefined, ctx.cookie);
    const second = await request("/api/admin/blog?page=2", "GET", undefined, ctx.cookie);
    assert.equal(first.data.posts.length, 20);
    assert.equal(first.data.posts[0].title, title(24));
    assert.equal(first.data.posts[19].title, title(5));
    assert.equal(second.data.posts[0].title, title(4));
    const publicFirst = await (await fetch(`${base}/blog`)).text();
    const publicSecond = await (await fetch(`${base}/blog?page=2`)).text();
    for (let index = 0; index < 25; index++) {
      assert.equal(publicFirst.includes(title(index)), index >= 12 && index < 24);
      assert.equal(publicSecond.includes(title(index)), index < 12);
    }
    const home = await (await fetch(base)).text();
    for (let index = 0; index < 25; index++) assert.equal(home.includes(title(index)), index >= 21 && index < 24);
    assert.equal((await fetch(`${base}/blog?page=invalid`)).status, 404);
  } finally {
    await ctx.prisma.blogPost.deleteMany({ where: { title: { startsWith: ctx.prefix } } });
    await ctx.cleanup();
  }
});
