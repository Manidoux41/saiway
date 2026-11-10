import test from "node:test";
import { assert, request, setup, createAccount } from "./helpers.mjs";
import { guestDriver, guestSession, gpsInput, cleanupGuest } from "./guest-ride-helpers.mjs";

test("private guest tracking exposes the assigned driver immediately, updates on approach and stops at cancellation", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const driver = await guestDriver(ctx);
    const other = await guestDriver(ctx, "other");
    const cookie = await guestSession(), stranger = await guestSession();
    const created = await request("/api/guest-rides", "POST", gpsInput(), cookie);
    assert.equal(created.status, 201);
    references.push(created.data.booking.reference);
    const booking = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[0] } });
    const assigned = booking.driverId === driver.profile.id ? driver : other;
    const unrelated = assigned === driver ? other : driver;
    assert.equal(created.data.booking.status, "DRIVER_ACCEPTED");
    assert.equal(created.data.booking.location.latitude, 13.3601234);
    assert.equal((await request("/api/guest-rides", "GET")).status, 401);
    assert.equal((await request("/api/guest-rides", "GET", undefined, stranger)).data.booking, null);
    await ctx.prisma.driverLocation.create({ data: { driverId: unrelated.profile.id, latitude: 14, longitude: 104, accuracy: 5 } });
    const old = new Date(Date.now() - 180000);
    await ctx.prisma.driverLocation.updateMany({ where: { driverId: assigned.profile.id }, data: { recordedAt: old } });
    const stale = await request("/api/guest-rides", "GET", undefined, cookie);
    assert.equal(stale.data.booking.location.recordedAt, old.toISOString(), "Keep the real timestamp for stale-map warning");
    assert.equal(stale.data.booking.location.latitude, 13.3601234);
    await ctx.prisma.driverLocation.deleteMany({ where: { driverId: assigned.profile.id } });
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking.location, null);
    const unrelatedTrip = await ctx.prisma.booking.create({ data: {
      reference: `${ctx.prefix}-unrelated`, originType: "DRIVER", driverId: assigned.profile.id,
      fromAddress: "Private pickup", toAddress: "Private dropoff", tripType: "CITY_TRANSFER",
      direction: "AIRPORT_TO_CITY", pickupAt: new Date(Date.now() - 86400000), status: "TRIP_COMPLETED", priceCents: 500, passengers: 1,
    } });
    references.push(unrelatedTrip.reference);
    await ctx.prisma.driverLocation.create({ data: { driverId: assigned.profile.id, bookingId: unrelatedTrip.id, latitude: 15, longitude: 105, accuracy: 5 } });
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking.location, null, "Another trip's last position must not leak");
    await ctx.prisma.driverLocation.create({ data: { driverId: assigned.profile.id, latitude: 13.365, longitude: 103.855, accuracy: 5 } });
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking.location.latitude, 13.365);
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: booking.id, status: "DRIVER_EN_ROUTE" }, assigned.cookie)).status, 200);
    await ctx.prisma.driverLocation.create({ data: { driverId: assigned.profile.id, bookingId: booking.id, latitude: 13.361, longitude: 103.851, accuracy: 5 } });
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking.location.latitude, 13.361);
    assert.equal((await request("/api/guest-rides", "DELETE", undefined, cookie)).status, 200);
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking.location, null);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status, "CANCELLED");
  } finally { await cleanupGuest(ctx, references); }
});

test("registered clients see an assigned driver's available fix without reading other trips or other drivers after reassignment", async () => {
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, "CUSTOMER");
    const stranger = await createAccount(ctx, "CUSTOMER", "stranger");
    const driver = await guestDriver(ctx);
    const second = await guestDriver(ctx, "replacement");
    const created = await request("/api/bookings", "POST", {
      fromAddress: "SAI Airport", toAddress: "Test hotel", direction: "AIRPORT_TO_CITY",
      tripType: "PRIVATE_TRANSFER", passengers: 1, pickupAt: new Date(Date.now() + 86400000).toISOString(),
    }, customer.cookie);
    assert.equal(created.status, 201);
    const id = created.data.booking.id;
    await ctx.prisma.booking.update({ where: { id }, data: { driverId: driver.profile.id, status: "DRIVER_ASSIGNED" } });
    const path = `/api/bookings/${id}/location`;
    assert.equal((await request(path)).status, 401);
    assert.equal((await request(path, "GET", undefined, stranger.cookie)).status, 404);
    const initial = await request(path, "GET", undefined, customer.cookie);
    assert.equal(initial.status, 200);
    assert.equal(initial.data.tracking, true);
    assert.equal(initial.data.location.latitude, 13.3601234);
    assert.deepEqual(initial.data.history, [], "Do not expose driver's unallocated history");
    await ctx.prisma.driverLocation.create({ data: { driverId: driver.profile.id, bookingId: id, latitude: 14, longitude: 104, accuracy: 5 } });
    await ctx.prisma.booking.update({ where: { id }, data: { driverId: second.profile.id, status: "DRIVER_ACCEPTED" } });
    const reassigned = await request(path, "GET", undefined, customer.cookie);
    assert.equal(reassigned.data.location.latitude, 13.3601234);
    assert.deepEqual(reassigned.data.history, []);
    assert.equal((await request(path, "GET", undefined, driver.cookie)).status, 404);
    await ctx.prisma.booking.update({ where: { id }, data: { status: "CANCELLED" } });
    const ended = await request(path, "GET", undefined, customer.cookie);
    assert.equal(ended.data.location, null);
    assert.equal(ended.data.tracking, false);
  } finally { await ctx.cleanup(); }
});
