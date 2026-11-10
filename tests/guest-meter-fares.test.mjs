import test from "node:test";
import { assert, request, setup, createAccount } from "./helpers.mjs";
import { gpsInput, guestSession, guestDriver, cleanupGuest } from "./guest-ride-helpers.mjs";

async function startGuest(ctx, references, point = { latitude: 13.3601234, longitude: 103.8501234 }) {
  const driver = await guestDriver(ctx);
  await ctx.prisma.driverLocation.updateMany({ where: { driverId: driver.profile.id }, data: point });
  const cookie = await guestSession();
  const created = await request("/api/guest-rides", "POST", gpsInput(), cookie);
  assert.equal(created.status, 201);
  references.push(created.data.booking.reference);
  const trip = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: created.data.booking.reference } });
  for (const status of ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED"]) assert.equal((await request("/api/driver/bookings", "PATCH", { id: trip.id, status }, driver.cookie)).status, 200);
  const start = await request("/api/driver/bookings", "PATCH", { id: trip.id, status: "TRIP_STARTED" }, driver.cookie);
  assert.equal(start.status, 200);
  return { driver, cookie, trip: start.data.booking };
}
async function trace(ctx, driver, trip, points, seconds = 30) {
  const start = new Date(Date.now() - points.length * seconds * 1000);
  await ctx.prisma.booking.update({ where: { id: trip.id }, data: { startedAt: start, fareDetails: { ...trip.fareDetails, startedAt: start.toISOString() } } });
  await ctx.prisma.driverLocation.deleteMany({ where: { bookingId: trip.id } });
  await ctx.prisma.driverLocation.createMany({ data: points.map((point, index) => ({ ...point, accuracy: point.accuracy ?? 5, driverId: driver.profile.id, bookingId: trip.id, recordedAt: new Date(start.getTime() + (index + 1) * seconds * 1000) })) });
}

test("completed GPS fare can be changed without reason only by its driver before payment, persists and is audited into accounting", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const other = await createAccount(ctx, "DRIVER", "other");
    const { driver, trip, cookie } = await startGuest(ctx, references);
    const correction = { id: trip.id, finalPriceCents: 725, expectedPriceCents: 0 };
    assert.equal((await request("/api/driver/bookings", "PATCH", correction)).status, 403);
    assert.equal((await request("/api/driver/bookings", "PATCH", correction, driver.cookie)).status, 409);
    await trace(ctx, driver, trip, [1, 2, 3].map(index => ({ latitude: 13.3601234, longitude: 103.8501234 + index * 0.002 })));
    const finished = await request("/api/driver/bookings", "PATCH", { id: trip.id, status: "TRIP_COMPLETED" }, driver.cookie);
    assert.equal(finished.status, 200);
    correction.expectedPriceCents = finished.data.booking.priceCents;
    assert.equal((await request("/api/driver/bookings", "PATCH", correction, other.cookie)).status, 404);
    assert.equal((await request("/api/driver/bookings", "PATCH", { ...correction, expectedPriceCents: 1 }, driver.cookie)).status, 409);
    const adjusted = await request("/api/driver/bookings", "PATCH", correction, driver.cookie);
    assert.equal(adjusted.status, 200);
    assert.equal(adjusted.data.booking.priceCents, 725);
    assert.equal(adjusted.data.booking.pricingStatus, "DRIVER_ADJUSTED");
    assert.ok(adjusted.data.booking.statusHistory.some(item => item.note.includes("DRIVER PRICE_ADJUSTMENT")));
    assert.equal((await request("/api/guest-rides", "GET", undefined, cookie)).data.booking.priceCents, 725);
    const audit = await ctx.prisma.auditLog.findFirstOrThrow({ where: { entityId: trip.id, action: "PRICE_ADJUSTMENT" } });
    assert.equal(audit.actorId, driver.id);
    assert.equal(audit.metadata.newCents, 725);
    assert.equal(audit.metadata.reason, null);
    const processing = await ctx.prisma.payment.create({ data: { bookingId: trip.id, provider: "VALIDATION", status: "PROCESSING", amountCents: 725, currency: "USD" } });
    assert.equal((await request("/api/driver/bookings", "PATCH", { ...correction, expectedPriceCents: 725, finalPriceCents: 800 }, driver.cookie)).status, 409);
    await ctx.prisma.payment.delete({ where: { id: processing.id } });
    const receipt = await request("/api/driver/payments", "POST", { bookingId: trip.id, received: true, collectionMethod: "CASH" }, driver.cookie);
    assert.equal(receipt.status, 200);
    assert.equal(receipt.data.booking.payments[0].amountCents, 725);
    assert.equal((await request("/api/driver/bookings", "PATCH", { ...correction, expectedPriceCents: 725, finalPriceCents: 900 }, driver.cookie)).status, 409);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: trip.id } })).priceCents, 725);
    const payment = await ctx.prisma.payment.findFirstOrThrow({ where: { bookingId: trip.id } });
    assert.ok(await ctx.prisma.accountingEntry.count({ where: { sourceKey: `payment:${payment.id}` } }));
  } finally { await cleanupGuest(ctx, references); }
});

test("boarding requires fresh precise driver GPS and the active meter cannot be repriced or collected", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const driver = await guestDriver(ctx);
    await ctx.prisma.driverLocation.updateMany({ where: { driverId: driver.profile.id }, data: { recordedAt: new Date(Date.now() - 60000) } });
    const cookie = await guestSession();
    const created = await request("/api/guest-rides", "POST", gpsInput(), cookie);
    assert.equal(created.status, 201);
    references.push(created.data.booking.reference);
    const trip = await ctx.prisma.booking.findUniqueOrThrow({ where: { reference: references[0] } });
    for (const status of ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED"]) assert.equal((await request("/api/driver/bookings", "PATCH", { id: trip.id, status }, driver.cookie)).status, 200);
    const body = { id: trip.id, status: "TRIP_STARTED" };
    assert.equal((await request("/api/driver/bookings", "PATCH", body, driver.cookie)).data.error, "GUEST_START_GPS_REQUIRED");
    await ctx.prisma.driverLocation.create({ data: { driverId: driver.profile.id, latitude: 13.36, longitude: 103.85, accuracy: 80 } });
    assert.equal((await request("/api/driver/bookings", "PATCH", body, driver.cookie)).data.error, "GUEST_START_GPS_REQUIRED");
    await ctx.prisma.driverLocation.create({ data: { driverId: driver.profile.id, latitude: 13.36, longitude: 103.85, accuracy: 5 } });
    assert.equal((await request("/api/driver/bookings", "PATCH", body, driver.cookie)).status, 200);
    assert.equal((await request("/api/admin/bookings", "PATCH", { id: trip.id, finalPriceCents: 500, priceReason: "No active fare correction" }, ctx.cookie)).status, 409);
    assert.equal((await request("/api/driver/payments", "POST", { bookingId: trip.id, received: true, collectionMethod: "CASH" }, driver.cookie)).status, 409);
    const stored = await ctx.prisma.booking.findUniqueOrThrow({ where: { id: trip.id } });
    assert.equal(stored.status, "TRIP_STARTED");
    assert.equal(stored.pricingStatus, "GPS_METER");
    assert.equal(stored.priceCents, 0);
    const fleet = await request("/api/admin/fleet-locations", "GET", undefined, ctx.cookie);
    assert.equal(fleet.status, 200);
    assert.equal(fleet.data.drivers.find(item => item.id === driver.profile.id).target, null);
  } finally { await cleanupGuest(ctx, references); }
});

test("GPS gaps require explicit road fallback to real dropoff, missing GPS blocks completion rather than creating a free trip", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const { driver, trip } = await startGuest(ctx, references);
    const finish = { id: trip.id, status: "TRIP_COMPLETED" };
    assert.equal((await request("/api/driver/bookings", "PATCH", finish, driver.cookie)).data.error, "GUEST_DROPOFF_GPS_REQUIRED");
    await trace(ctx, driver, trip, [{ latitude: 13.37, longitude: 103.86 }], 120);
    const incomplete = await request("/api/driver/bookings", "PATCH", finish, driver.cookie);
    assert.equal(incomplete.status, 409);
    assert.equal(incomplete.data.error, "GPS_INCOMPLETE_CONFIRM_ROUTE");
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: trip.id } })).status, "TRIP_STARTED");
    const finished = await request("/api/driver/bookings", "PATCH", { ...finish, confirmEstimatedDistance: true }, driver.cookie);
    assert.equal(finished.status, 200);
    assert.equal(finished.data.booking.fareDetails.distanceSource, "CONFIRMED_ROUTE");
    assert.equal(finished.data.booking.fareDetails.distanceMeters, 5000);
    assert.equal(finished.data.booking.priceCents, 375);
    assert.equal(finished.data.booking.toAddress, "GPS: 13.3700000, 103.8600000");
  } finally { await cleanupGuest(ctx, references); }
});

test("airport package follows the GPS dropoff and cannot be increased past USD 30 by the driver", async () => {
  const ctx = await setup();
  const references = [];
  try {
    const { driver, trip } = await startGuest(ctx, references, { latitude: 13.3692, longitude: 104.1991 });
    await trace(ctx, driver, trip, [1, 2, 3, 4].map(index => ({ latitude: 13.3692, longitude: 104.1991 + index * 0.006 })));
    const finished = await request("/api/driver/bookings", "PATCH", { id: trip.id, status: "TRIP_COMPLETED" }, driver.cookie);
    assert.equal(finished.status, 200);
    assert.equal(finished.data.booking.tripType, "AIRPORT_TRANSFER");
    assert.equal(finished.data.booking.priceCents, 3000);
    assert.equal(finished.data.booking.fareDetails.mode, "AIRPORT");
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: trip.id, finalPriceCents: 3001, expectedPriceCents: 3000 }, driver.cookie)).status, 400);
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: trip.id, finalPriceCents: 2800, expectedPriceCents: 3000 }, driver.cookie)).status, 200);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: trip.id } })).priceCents, 2800);
  } finally { await cleanupGuest(ctx, references); }
});
