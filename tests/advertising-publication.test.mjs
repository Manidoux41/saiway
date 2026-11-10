import test from "node:test";
import { assert, request, setup, createAccount } from "./helpers.mjs";

const input = (prefix, overrides = {}) => ({
  advertiser: prefix, contactName: "PRIVATE", contactEmail: "private@example.invalid", contactPhone: null,
  title: "Tour offer", description: "Travel information", targetUrl: "https://example.com", placements: ["HOME"],
  status: "DRAFT", startsAt: new Date(Date.now() - 3600000).toISOString(), endsAt: new Date(Date.now() + 86400000).toISOString(),
  amountCents: 100, priority: 2, notes: "PRIVATE", terms: "PRIVATE", ...overrides,
});
test("public advertising enforces manual activation, dates, locations, priority, privacy and removal", async () => {
  const ctx = await setup();
  try {
    const driver = await createAccount(ctx, "DRIVER");
    const created = await request("/api/admin/advertising", "POST", input(ctx.prefix), ctx.cookie);
    assert.equal(created.status, 201);
    const draft = created.data.contract;
    const publicIds = async (placement, cookie) => {
      const response = await request(`/api/advertising?placement=${placement}`, "GET", undefined, cookie);
      assert.equal(response.status, 200);
      return response.data.advertisements;
    };
    assert.equal((await publicIds("HOME")).some((item) => item.id === draft.id), false);
    const enabled = await request(`/api/admin/advertising/${draft.id}`, "PATCH", { ...input(ctx.prefix, { status: "ACTIVE" }), expectedUpdatedAt: draft.updatedAt }, ctx.cookie);
    assert.equal(enabled.status, 200);
    let current = enabled.data.contract;
    const ad = (await publicIds("HOME")).find((item) => item.id === draft.id);
    assert.ok(ad);
    assert.deepEqual(Object.keys(ad).sort(), ["advertiser", "description", "endsAt", "id", "image", "targetUrl", "title"]);
    assert.equal((await publicIds("BLOG")).some((item) => item.id === draft.id), false);
    for (const overrides of [
      { status: "PAUSED" }, { status: "ENDED" }, { startsAt: new Date(Date.now() + 3600000).toISOString() },
      { startsAt: "2020-01-01T00:00:00Z", endsAt: "2020-02-01T00:00:00Z" },
    ]) {
      const edited = await request(`/api/admin/advertising/${draft.id}`, "PATCH", { ...input(ctx.prefix, { status: "ACTIVE", ...overrides }), expectedUpdatedAt: current.updatedAt }, ctx.cookie);
      assert.equal(edited.status, 200);
      current = edited.data.contract;
      assert.equal((await publicIds("HOME")).some((item) => item.id === draft.id), false);
    }
    const future = new Date(Date.now() + 2000).toISOString();
    const scheduled = await request(`/api/admin/advertising/${draft.id}`, "PATCH", { ...input(ctx.prefix, { status: "ACTIVE", startsAt: future, endsAt: new Date(Date.now() + 7000).toISOString(), placements: ["DRIVER"] }), expectedUpdatedAt: current.updatedAt }, ctx.cookie);
    assert.equal(scheduled.status, 200);
    assert.equal((await request("/api/advertising?placement=DRIVER")).status, 403);
    assert.equal((await publicIds("DRIVER", driver.cookie)).some((item) => item.id === draft.id), false);
    await new Promise((resolve) => setTimeout(resolve, 2200));
    assert.equal((await publicIds("DRIVER", driver.cookie)).some((item) => item.id === draft.id), true);
    await new Promise((resolve) => setTimeout(resolve, 5000));
    assert.equal((await publicIds("DRIVER", driver.cookie)).some((item) => item.id === draft.id), false);
    for (let priority = 10; priority >= 1; priority--) await ctx.prisma.advertisingContract.create({ data: {
      ...input(`${ctx.prefix}-${priority}`, { status: "ACTIVE", priority, placements: ["BLOG"] }),
      reference: `${ctx.prefix}-${priority}`,
    } });
    const ads = await publicIds("BLOG");
    assert.equal(ads.length, 6);
    assert.deepEqual(ads.map((item) => Number(item.advertiser.slice(item.advertiser.lastIndexOf("-") + 1))), [1, 2, 3, 4, 5, 6]);
    assert.equal((await request("/api/advertising?placement=ADMIN")).status, 400);
    assert.equal((await request("/api/advertising")).status, 400);
  } finally {
    await ctx.prisma.advertisingContract.deleteMany({ where: { advertiser: { startsWith: ctx.prefix } } });
    await ctx.cleanup();
  }
});
