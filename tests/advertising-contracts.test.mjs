import test from "node:test";
import { assert, request, setup, createAccount } from "./helpers.mjs";

export function contractInput(prefix, overrides = {}) {
  return {
    advertiser: prefix, contactName: "Private contact", contactEmail: "private@example.invalid", contactPhone: "+85512345678",
    title: "Visit Siem Reap", description: "Tours and local experiences", targetUrl: "https://example.com/tours",
    placements: ["HOME", "BLOG"], status: "DRAFT", startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 86400000).toISOString(), amountCents: 12550, priority: 1,
    notes: "PRIVATE administration notes", terms: "Agreed terms", ...overrides,
  };
}
test("advertising contracts require ADMIN, persist audited changes and retain archived history", async () => {
  const ctx = await setup();
  try {
    const accountingBefore = await ctx.prisma.accountingEntry.count();
    const customer = await createAccount(ctx, "CUSTOMER");
    const driver = await createAccount(ctx, "DRIVER");
    for (const cookie of [undefined, customer.cookie, driver.cookie]) {
      assert.equal((await request("/api/admin/advertising", "GET", undefined, cookie)).status, 403);
      assert.equal((await request("/api/admin/advertising", "POST", contractInput(ctx.prefix), cookie)).status, 403);
      assert.equal((await request("/api/admin/advertising/nonexistent", "PATCH", {}, cookie)).status, 403);
      assert.equal((await request("/api/admin/advertising/nonexistent", "DELETE", {}, cookie)).status, 403);
      const pdf = await fetch(`${process.env.VALIDATION_URL}/api/admin/advertising/nonexistent/pdf`, { headers: cookie ? { cookie } : {} });
      assert.equal(pdf.status, 403);
    }
    assert.equal((await request("/api/admin/advertising", "POST", { ...contractInput(ctx.prefix), targetUrl: "javascript:alert(1)" }, ctx.cookie)).status, 400);
    const initial = await request("/api/admin/advertising", "POST", contractInput(ctx.prefix), ctx.cookie);
    assert.equal(initial.status, 201);
    let contract = initial.data.contract;
    assert.equal(contract.status, "DRAFT");
    assert.equal(contract.currency, "USD");
    assert.match(contract.reference, /^AD-\d{4}-[A-F0-9]{8}$/);
    const path = `/api/admin/advertising/${contract.id}`;
    assert.equal((await request(path, "PATCH", contractInput(ctx.prefix), ctx.cookie)).status, 400);
    const edit = await request(path, "PATCH", { ...contractInput(ctx.prefix, { status: "ACTIVE", amountCents: 15000 }), expectedUpdatedAt: contract.updatedAt }, ctx.cookie);
    assert.equal(edit.status, 200);
    assert.equal(edit.data.contract.amountCents, 15000);
    assert.equal((await request(path, "PATCH", { ...contractInput(ctx.prefix), expectedUpdatedAt: contract.updatedAt }, ctx.cookie)).status, 409);
    contract = edit.data.contract;
    const listing = await request("/api/admin/advertising", "GET", undefined, ctx.cookie);
    assert.deepEqual(listing.data.contracts.find((item) => item.id === contract.id), contract);
    assert.equal((await request(path, "DELETE", { expectedUpdatedAt: initial.data.contract.updatedAt, reason: "Archive" }, ctx.cookie)).status, 409);
    assert.equal((await request(path, "DELETE", { expectedUpdatedAt: contract.updatedAt }, ctx.cookie)).status, 400);
    assert.equal((await request(path, "DELETE", { expectedUpdatedAt: contract.updatedAt, reason: "Contract cancelled" }, ctx.cookie)).status, 200);
    const archived = await ctx.prisma.advertisingContract.findUniqueOrThrow({ where: { id: contract.id } });
    assert.ok(archived.deletedAt);
    assert.equal(archived.status, "ENDED");
    assert.equal((await request("/api/admin/advertising", "GET", undefined, ctx.cookie)).data.contracts.some((item) => item.id === contract.id), false);
    const logs = await ctx.prisma.auditLog.findMany({ where: { entityId: contract.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(logs.map((log) => log.action), ["CREATE", "UPDATE", "DELETE"]);
    assert.ok(logs.every((log) => log.actorId === ctx.id));
    assert.equal(logs[1].metadata.before.amountCents, 12550);
    assert.equal(logs[1].metadata.after.amountCents, 15000);
    assert.equal(logs[2].metadata.reason, "Contract cancelled");
    assert.ok(logs[2].metadata.after.deletedAt);
    assert.equal(await ctx.prisma.accountingEntry.count(), accountingBefore);
  } finally {
    await ctx.prisma.advertisingContract.deleteMany({ where: { advertiser: { startsWith: ctx.prefix } } });
    await ctx.cleanup();
  }
});
