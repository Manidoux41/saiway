import test from "node:test";
import { assert, request, setup, createAccount } from "./helpers.mjs";
import { gpsInput, guestSession, guestDriver, cleanupGuest } from "./guest-ride-helpers.mjs";

test("guest pickup autoaccepts, starts without destination and meters only after boarding, retaining private tracking and one booking", async () => {
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
    assert.equal(stored.status, "DRIVER_ACCEPTED");
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: stored.id, status: "DRIVER_ACCEPTED" }, other.cookie)).status, 404);
    assert.equal((await request(`/api/bookings/${stored.id}/location`, "GET", undefined, customer.cookie)).status, 404);
    for (const status of ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED"]) assert.equal((await request("/api/driver/bookings", "PATCH", { id: stored.id, status }, driver.cookie)).status, 200);
    await ctx.prisma.driverLocation.create({ data: { bookingId: stored.id, driverId: driver.profile.id, latitude: 13.3602, longitude: 103.8502, accuracy: 5 } });
    const view = await request("/api/guest-rides", "GET", undefined, a);
    assert.equal(view.data.booking.status, "DRIVER_ARRIVED");
    assert.equal(view.data.booking.location.latitude, 13.3602);
    assert.equal(view.data.booking.driverName, driver.profile.user?.name ?? `${ctx.prefix}-driver`);
    assert.equal((await request("/api/guest-rides", "GET", undefined, b)).data.booking, null);
    assert.equal((await request("/api/admin/bookings", "PATCH", { id: stored.id, finalPriceCents: 500, priceReason: "Cannot bypass destination" }, ctx.cookie)).status, 409);
    const body = { id: stored.id, status: "TRIP_STARTED" };
    assert.equal((await request("/api/driver/bookings", "PATCH", body)).status, 403);
    assert.equal((await request("/api/driver/bookings", "PATCH", body, other.cookie)).status, 404);
    const started = await request("/api/driver/bookings", "PATCH", body, driver.cookie);
    assert.equal(started.status, 200);
    assert.equal(started.data.booking.id, stored.id);
    assert.equal(started.data.booking.reference, stored.reference);
    assert.equal(started.data.booking.originType, "GUEST");
    assert.equal(started.data.booking.customerId, null);
    assert.equal(started.data.booking.status, "TRIP_STARTED");
    assert.equal(started.data.booking.fareDetails.guestMeter, true);
    assert.equal(started.data.booking.pricingStatus, "GPS_METER");
    assert.equal((await request("/api/driver/bookings", "PATCH", body, driver.cookie)).status, 403);
    assert.equal((await request("/api/guest-rides", "DELETE", undefined, a)).status, 409);
    const confirmed = await request("/api/guest-rides", "GET", undefined, a);
    assert.equal(confirmed.data.booking.toAddress, null);
    assert.equal(confirmed.data.booking.priceCents, null);
    const start = new Date(Date.now() - 150000);
    await ctx.prisma.booking.update({ where: { id: stored.id }, data: { startedAt: start, fareDetails: { ...started.data.booking.fareDetails, startedAt: start.toISOString() } } });
    await ctx.prisma.driverLocation.deleteMany({ where: { bookingId: stored.id } });
    await ctx.prisma.driverLocation.create({ data: { bookingId: stored.id, driverId: driver.profile.id, latitude: 13.36, longitude: 104.1, accuracy: 5, recordedAt: new Date(start.getTime() - 1000) } });
    await ctx.prisma.driverLocation.createMany({ data: [1, 2, 3, 4, 5].map(index => ({
      bookingId: stored.id, driverId: driver.profile.id, latitude: 13.3602, longitude: 103.8502 + index * 0.003,
      accuracy: 5, recordedAt: new Date(start.getTime() + index * 30000),
    })) });
    assert.equal((await request(`/api/driver/bookings?meter=${stored.id}`)).status, 403);
    assert.equal((await request(`/api/driver/bookings?meter=${stored.id}`, "GET", undefined, other.cookie)).status, 404);
    const meter = await request(`/api/driver/bookings?meter=${stored.id}`, "GET", undefined, driver.cookie);
    assert.equal(meter.status, 200);
    assert.equal(meter.data.complete, true);
    assert.ok(meter.data.distanceMeters > 1600 && meter.data.distanceMeters < 1650);
    const finished = await request("/api/driver/bookings", "PATCH", { id: stored.id, status: "TRIP_COMPLETED", finalPoint: { latitude: 0, longitude: 0 } }, driver.cookie);
    assert.equal(finished.status, 200);
    assert.equal(finished.data.booking.fareDetails.distanceSource, "GPS");
    assert.equal(finished.data.booking.priceCents, Math.max(375, Math.round(meter.data.distanceMeters * 65 / 1000)));
    assert.equal(finished.data.booking.finalLatitude, "13.3602");
    assert.match(finished.data.booking.toAddress, /^GPS: 13\.3602/);
    const done = await request("/api/guest-rides", "GET", undefined, a);
    assert.equal(done.data.booking.status, "TRIP_COMPLETED");
    assert.equal(done.data.booking.location, null);
    assert.equal(await ctx.prisma.booking.count({ where: { reference: stored.reference } }), 1);
    assert.equal((await request("/api/bookings", "GET", undefined, customer.cookie)).data.bookings.length, 0);
  } finally { await cleanupGuest(ctx, references); }
});

test("GPS pickup without a free driver waits for admin assignment and the passenger can cancel after arrival", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const driver = await guestDriver(ctx);
    await ctx.prisma.driverProfile.update({ where: { id: driver.profile.id }, data: { isAvailable: false } });
    const cookie = await guestSession();
    const created = await request("/api/guest-rides", "POST", gpsInput(), cookie);
    assert.equal(created.status, 201);
    references.push(created.data.booking.reference);
    const booking = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[0] } });
    assert.equal(booking.driverId, null);
    assert.equal(booking.status, "DRIVER_ASSIGNMENT_PENDING");
    await ctx.prisma.driverProfile.update({ where: { id: driver.profile.id }, data: { isAvailable: true } });
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
