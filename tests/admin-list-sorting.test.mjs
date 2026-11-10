import test from "node:test";
import { assert, request, setup, createAccount } from "./helpers.mjs";

test("admin blog sorting covers the entire dataset before pagination, validates criteria and preserves access control", async () => {
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL).hostname));
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, "CUSTOMER");
    for (const cookie of [undefined, customer.cookie]) {
      assert.equal((await request("/api/admin/blog?sort=title&direction=asc", "GET", undefined, cookie)).status, 403);
    }
    for (const query of ["sort=invalid", "direction=invalid", "page=0", "page=1.5", "page=100001"]) {
      assert.equal((await request(`/api/admin/blog?${query}`, "GET", undefined, ctx.cookie)).status, 400);
    }
    await ctx.prisma.blogPost.createMany({ data: Array.from({ length: 25 }, (_, index) => ({
      title: `${ctx.prefix} article ${String(24 - index).padStart(2, "0")}`,
      excerpt: "Travel", content: "Local tips", language: index % 2 ? "fr" : "en", published: index % 3 === 0,
      publishedAt: index % 3 === 0 ? new Date(Date.UTC(2026, 0, index + 1)) : null,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)),
      updatedAt: new Date(Date.UTC(2026, 1, 25 - index)),
    })) });
    for (const sort of ["createdAt", "updatedAt", "publishedAt", "title", "language", "published", "featured", "layout"]) {
      for (const direction of ["asc", "desc"]) {
        const orderBy = sort === "publishedAt" ? { publishedAt: { sort: direction, nulls: "last" } } : { [sort]: direction };
        const expected = await ctx.prisma.blogPost.findMany({ orderBy: [orderBy, { id: direction }], select: { id: true } });
        const actual = [];
        for (let page = 1; page <= Math.ceil(expected.length / 20); page++) {
          const response = await request(`/api/admin/blog?page=${page}&sort=${sort}&direction=${direction}`, "GET", undefined, ctx.cookie);
          assert.equal(response.status, 200);
          assert.ok(response.data.posts.length <= 20);
          actual.push(...response.data.posts.map((post) => post.id));
        }
        assert.deepEqual(actual, expected.map((post) => post.id), `${sort} ${direction} across pages`);
        assert.equal(new Set(actual).size, actual.length);
      }
    }
    const management = await request("/api/admin/management", "GET", undefined, ctx.cookie);
    assert.equal(management.status, 200);
    assert.ok(management.data.users.every((item) => Number.isFinite(Date.parse(item.createdAt))));
    assert.ok(management.data.vehicles.every((item) => Number.isFinite(Date.parse(item.createdAt))));
    assert.ok(management.data.hubs.every((item) => Number.isFinite(Date.parse(item.createdAt))));
  } finally {
    await ctx.prisma.blogPost.deleteMany({ where: { title: { startsWith: ctx.prefix } } });
    await ctx.cleanup();
  }
});
