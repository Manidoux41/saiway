import test from "node:test";
import { assert, request, setup, createAccount } from "./helpers.mjs";
import { gpsInput, guestSession, guestDriver, cleanupGuest } from "./guest-ride-helpers.mjs";

test("guest pickup dispatch, driver status and private tracking retain one booking and require a destination/fare before start", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const driver = await guestDriver(ctx);
    const other = await createAccount(ctx, "DRIVER", "other");
    const customer = await createAccount(ctx, "CUSTOMER");
    const a = await guestSession(), b = await guestSession();
    const created = await request("/api/guest-rides", "POST", gpsInput(), a);
    assert.equal(created.status, 201);
    references.push(created.data.booking.reference);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[0] } });
    assert.equal(stored.driverId, driver.profile.id);
    assert.equal(stored.status, "DRIVER_ASSIGNED");
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: stored.id, status: "DRIVER_ACCEPTED" }, other.cookie)).status, 404);
    assert.equal((await request(`/api/bookings/${stored.id}/location`, "GET", undefined, customer.cookie)).status, 404);
    for (const status of ["DRIVER_ACCEPTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"]) assert.equal((await request("/api/driver/bookings", "PATCH", { id: stored.id, status }, driver.cookie)).status, 200);
    await ctx.prisma.driverLocation.create({ data: { bookingId: stored.id, driverId: driver.profile.id, latitude: 13.3602, longitude: 103.8502, accuracy: 5 } });
    const view = await request("/api/guest-rides", "GET", undefined, a);
    assert.equal(view.data.booking.status, "DRIVER_ARRIVED");
    assert.equal(view.data.booking.location.latitude, 13.3602);
    assert.equal(view.data.booking.driverName, driver.profile.user?.name ?? `${ctx.prefix}-driver`);
    assert.equal((await request("/api/guest-rides", "GET", undefined, b)).data.booking, null);
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: stored.id, status: "TRIP_STARTED" }, driver.cookie)).status, 409);
    assert.equal((await request("/api/admin/bookings", "PATCH", { id: stored.id, finalPriceCents: 500, priceReason: "Cannot bypass destination" }, ctx.cookie)).status, 409);
    const preview = await request("/api/driver/bookings", "POST", { action: "preview", selection: { vehicleId: driver.vehicle.id, fromAddress: stored.fromAddress, toAddress: "GPS: 13.3701234, 103.8601234" } }, driver.cookie);
    assert.equal(preview.status, 200);
    const body = { quoteToken: preview.data.token, passengers: 2, guestBookingId: stored.id };
    assert.equal((await request("/api/driver/bookings", "POST", body, other.cookie)).status, 400);
    const started = await request("/api/driver/bookings", "POST", body, driver.cookie);
    assert.equal(started.status, 201);
    assert.equal(started.data.booking.id, stored.id);
    assert.equal(started.data.booking.reference, stored.reference);
    assert.equal(started.data.booking.originType, "GUEST");
    assert.equal(started.data.booking.customerId, null);
    assert.equal(started.data.booking.status, "TRIP_STARTED");
    assert.ok(started.data.booking.priceCents > 0);
    assert.equal((await request("/api/driver/bookings", "POST", body, driver.cookie)).data.booking.id, stored.id);
    assert.equal((await request("/api/guest-rides", "DELETE", undefined, a)).status, 409);
    const confirmed = await request("/api/guest-rides", "GET", undefined, a);
    assert.equal(confirmed.data.booking.toAddress, "GPS: 13.3701234, 103.8601234");
    assert.equal(confirmed.data.booking.priceCents, started.data.booking.priceCents);
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: stored.id, status: "TRIP_COMPLETED", confirmEstimatedDistance: true }, driver.cookie)).status, 200);
    const done = await request("/api/guest-rides", "GET", undefined, a);
    assert.equal(done.data.booking.status, "TRIP_COMPLETED");
    assert.equal(done.data.booking.location, null);
    assert.equal(await ctx.prisma.booking.count({ where: { reference: stored.reference } }), 1);
    assert.equal((await request("/api/bookings", "GET", undefined, customer.cookie)).data.bookings.length, 0);
  } finally { await cleanupGuest(ctx, references); }
});

test("GPS pickup does not autoassign stale driver locations but administrators can assign and the passenger can cancel after arrival", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const driver = await guestDriver(ctx);
    await ctx.prisma.driverLocation.updateMany({ where: { driverId: driver.profile.id }, data: { recordedAt: new Date(Date.now() - 86400000) } });
    const cookie = await guestSession();
    const created = await request("/api/guest-rides", "POST", gpsInput(), cookie);
    assert.equal(created.status, 201);
    references.push(created.data.booking.reference);
    const booking = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[0] } });
    assert.equal(booking.driverId, null);
    assert.equal(booking.status, "DRIVER_ASSIGNMENT_PENDING");
    const assigned = await request("/api/admin/bookings", "PATCH", { id: booking.id, driverId: driver.profile.id, vehicleId: driver.vehicle.id, fromAddress: booking.fromAddress, toAddress: booking.toAddress, pickupAt: booking.pickupAt.toISOString(), passengers: 1, priceCents: 0, tripType: booking.tripType, direction: booking.direction }, ctx.cookie);
    assert.equal(assigned.status, 200);
    assert.equal(assigned.data.booking.status, "DRIVER_ASSIGNED");
    for (const status of ["DRIVER_ACCEPTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"]) assert.equal((await request("/api/driver/bookings", "PATCH", { id: booking.id, status }, driver.cookie)).status, 200);
    assert.equal((await request("/api/guest-rides", "DELETE", undefined, cookie)).status, 200);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    assert.equal(stored.status, "CANCELLED");
    assert.equal(stored.pricingStatus, "AWAITING_DESTINATION");
    assert.equal(await ctx.prisma.payment.count({ where: { bookingId: booking.id } }), 0);
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking.location, null);
  } finally { await cleanupGuest(ctx, references); }
});
