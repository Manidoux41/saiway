import test from "node:test";
import { createHash } from "node:crypto";
import { assert, request, setup, base } from "./helpers.mjs";
import { gpsInput, guestSession, cleanupGuest } from "./guest-ride-helpers.mjs";

test("anonymous GPS request creates no account, is retry-safe, privately readable and cancellable", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const userCount = await ctx.prisma.user.count();
    const paymentCount = await ctx.prisma.payment.count();
    const a = await guestSession(), b = await guestSession();
    for (const method of ["GET", "POST", "DELETE"]) assert.equal((await request("/api/guest-rides", method, method === "POST" ? gpsInput() : undefined)).status, 401);
    assert.equal((await request("/api/guest-rides", "GET", undefined, a)).data.booking, null);
    for (const change of [{ latitude: 91 }, { longitude: -181 }, { accuracy: 101 }, { name: "Not allowed" }, { capturedAt: "2020-01-01T00:00:00Z" }, { capturedAt: new Date(Date.now() + 60000).toISOString() }]) {
      assert.equal((await request("/api/guest-rides", "POST", { ...gpsInput(), ...change }, a)).status, 400);
    }
    const crossSite = await fetch(`${base}/api/guest-rides`, { method: "POST", headers: { cookie: a, origin: "https://other.invalid", "Content-Type": "application/json" }, body: JSON.stringify(gpsInput()) });
    assert.equal(crossSite.status, 403);
    const response = await fetch(`${base}/api/guest-rides`, { method: "POST", headers: { cookie: a, origin: new URL(base).origin, "sec-fetch-site": "same-origin", "Content-Type": "application/json" }, body: JSON.stringify(gpsInput()) });
    const created = { status: response.status, data: await response.json() };
    assert.equal(created.status, 201);
    const ride = created.data.booking;
    references.push(ride.reference);
    assert.equal(ride.priceCents, null);
    assert.equal(ride.toAddress, null);
    assert.equal(ride.status, "DRIVER_ASSIGNMENT_PENDING");
    const repeated = await Promise.all([1, 2, 3].map(() => request("/api/guest-rides", "POST", gpsInput(), a)));
    assert.ok(repeated.every((result) => result.status === 200 && result.data.booking.reference === ride.reference));
    assert.equal(await ctx.prisma.booking.count({ where: { reference: ride.reference } }), 1);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: ride.reference }, include: { guestAccess: true } });
    assert.equal(stored.customerId, null);
    assert.equal(stored.passengerName, null);
    assert.equal(stored.contactPhone, null);
    assert.equal(stored.originType, "GUEST");
    assert.equal(stored.pricingStatus, "AWAITING_DESTINATION");
    assert.equal(stored.guestAccess.tokenHash, createHash("sha256").update(a.split("=")[1]).digest("hex"));
    for (const key of ["id", "customerId", "guestAccess", "contactPhone", "pickupNotes", "fareDetails"]) assert.equal(key in ride, false);
    assert.deepEqual((await request("/api/guest-rides", "GET", undefined, a)).data.booking, ride);
    assert.equal((await request(`/api/guest-rides?reference=${ride.reference}`, "GET", undefined, b)).data.booking, null);
    assert.equal((await request("/api/guest-rides", "DELETE", { id: stored.id }, b)).status, 404);
    assert.equal((await request("/api/bookings", "GET", undefined, a)).status, 403);
    assert.equal((await request("/api/guest-rides/session", "POST", undefined, a)).status, 409);
    const admin = await request("/api/admin/bookings", "GET", undefined, ctx.cookie);
    assert.ok(admin.data.bookings.some((item) => item.id === stored.id && item.customer === null));
    assert.ok(admin.data.bookings.every((item) => !("guestAccess" in item) && !("tokenHash" in item)));
    const cancelled = await request("/api/guest-rides", "DELETE", undefined, a);
    assert.equal(cancelled.status, 200);
    assert.equal(cancelled.data.booking.status, "CANCELLED");
    assert.equal((await request("/api/guest-rides", "POST", gpsInput(), a)).data.booking.status, "CANCELLED");
    assert.equal((await request("/api/guest-rides", "DELETE", undefined, a)).status, 200);
    assert.equal((await request("/api/guest-rides/session", "POST", undefined, a)).status, 200);
    assert.equal(await ctx.prisma.user.count(), userCount);
    assert.equal(await ctx.prisma.payment.count(), paymentCount);
    assert.ok(await ctx.prisma.auditLog.count({ where: { entityId: stored.id, action: "GUEST_CANCEL" } }));
  } finally { await cleanupGuest(ctx, references); }
});

test("parallel first requests from one browser persist only one pickup", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const cookie = await guestSession();
    const results = await Promise.all([1, 2, 3].map(() => request("/api/guest-rides", "POST", gpsInput(), cookie)));
    references.push(...new Set(results.flatMap((result) => result.data.booking ? [result.data.booking.reference] : [])));
    assert.equal(references.length, 1);
    assert.ok(results.every((result) => [200, 201, 409].includes(result.status)));
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking.reference, references[0]);
    assert.equal(await ctx.prisma.booking.count({ where: { reference: { in: references } } }), 1);
  } finally { await cleanupGuest(ctx, references); }
});

test("GPS request throttling is persisted and rejects cross-site session reset without losing the existing request", async () => {
  const ctx = await setup();
  const key = `guest:global:${Math.floor(Date.now() / 600000)}`;
  const before = await ctx.prisma.guestRideLimit.findUnique({ where: { key } });
  try {
    const cookie = await guestSession();
    await ctx.prisma.guestRideLimit.upsert({ where: { key }, create: { key, attempts: 100, expiresAt: new Date(Date.now() + 1200000) }, update: { attempts: 100 } });
    const denied = await request("/api/guest-rides", "POST", gpsInput(), cookie);
    assert.equal(denied.status, 429);
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking, null);
    const crossSite = await fetch(`${base}/api/guest-rides/session`, { method: "POST", headers: { cookie, origin: "https://other.invalid" } });
    assert.equal(crossSite.status, 403);
    const retry = await fetch(`${base}/api/guest-rides`, { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body: JSON.stringify(gpsInput()) });
    assert.equal(retry.status, 429);
    assert.equal(retry.headers.get("retry-after"), "600");
  } finally {
    if (before) await ctx.prisma.guestRideLimit.update({ where: { key }, data: { attempts: before.attempts, expiresAt: before.expiresAt } });
    else await ctx.prisma.guestRideLimit.deleteMany({ where: { key } });
    await ctx.cleanup();
  }
});
