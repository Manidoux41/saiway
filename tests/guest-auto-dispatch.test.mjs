import test from "node:test";
import { assert, request, setup } from "./helpers.mjs";
import { gpsInput, guestSession, guestDriver, cleanupGuest } from "./guest-ride-helpers.mjs";

test("guest dispatch uses FIFO rather than GPS proximity, including stale or missing GPS; ordinary dispatch remains separate", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const first = await guestDriver(ctx, "oldest");
    const second = await guestDriver(ctx, "nearest");
    await ctx.prisma.driverProfile.update({ where: { id: first.profile.id }, data: { availableSince: new Date(Date.now() - 3600000) } });
    await ctx.prisma.driverLocation.deleteMany({ where: { driverId: first.profile.id } });
    const a = await guestSession();
    const created = await request("/api/guest-rides", "POST", gpsInput(), a);
    assert.equal(created.status, 201);
    references.push(created.data.booking.reference);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[0] } });
    assert.equal(stored.driverId, first.profile.id);
    assert.equal(stored.status, "DRIVER_ACCEPTED");
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: stored.id, status: "DRIVER_ACCEPTED" }, first.cookie)).status, 403);
    await ctx.prisma.booking.update({ where: { id: stored.id }, data: { pickupAt: new Date(Date.now() - 86400000), dispatchEndsAt: new Date(Date.now() - 3600000) } });
    const b = await guestSession();
    const next = await request("/api/guest-rides", "POST", gpsInput(), b);
    assert.equal(next.status, 201);
    references.push(next.data.booking.reference);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[1] } })).driverId, second.profile.id, "An overdue accepted pickup still occupies its driver");
    assert.equal((await request("/api/guest-rides", "DELETE", undefined, a)).status, 200);
    assert.equal((await request("/api/guest-rides", "GET", undefined, a)).data.booking.status, "CANCELLED");
  } finally { await cleanupGuest(ctx, references); }
});

test("parallel guest requests reserve a free driver and shared vehicle only once; remaining request belongs to admin", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const driver = await guestDriver(ctx);
    const second = await guestDriver(ctx, "same-vehicle");
    await ctx.prisma.driverProfile.update({ where: { id: second.profile.id }, data: { selectedVehicleId: driver.vehicle.id } });
    const cookies = await Promise.all([guestSession(), guestSession()]);
    const results = await Promise.all(cookies.map(cookie => request("/api/guest-rides", "POST", gpsInput(), cookie)));
    assert.ok(results.every(result => [201, 409].includes(result.status)));
    for (let i = 0; i < results.length; i++) {
      if (results[i].status === 409) results[i] = await request("/api/guest-rides", "POST", gpsInput(), cookies[i]);
      assert.equal(results[i].status, 201);
      references.push(results[i].data.booking.reference);
    }
    const rows = await ctx.prisma.booking.findMany({ where: { reference: { in: references } } });
    assert.equal(rows.filter(row => row.status === "DRIVER_ACCEPTED").length, 1);
    assert.equal(rows.filter(row => row.status === "DRIVER_ASSIGNMENT_PENDING").length, 1);
    const admin = await request("/api/admin/bookings", "GET", undefined, ctx.cookie);
    assert.ok(admin.data.bookings.some(row => row.id === rows.find(row => !row.driverId).id));
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: { in: rows.map(row => row.id) } } }), 0);
  } finally { await cleanupGuest(ctx, references); }
});
