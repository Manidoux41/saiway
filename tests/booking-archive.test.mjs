import { test } from "node:test";
import { assert, base, createAccount, request, setup } from "./helpers.mjs";

test("administrators archive and restore trips without deleting history or financial records", async () => {
  const url = new URL(process.env.PRISMA_DATABASE_URL || process.env.DATABASE_URL);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname), "Use an isolated local database");
  assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
  const ctx = await setup();
  try {
    const customer = await createAccount(ctx, "CUSTOMER");
    const driver = await createAccount(ctx, "DRIVER");
    const driverId = (await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: driver.id } })).id;
    const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: ctx.prefix, seats: 4 } });
    const make = async (status, suffix = status) => ctx.prisma.booking.create({ data: {
      reference: `${ctx.prefix}-${suffix}`, customerId: customer.id,
      ...(status.startsWith("DRIVER_") || status === "TRIP_COMPLETED" || status === "TRIP_STARTED" ? { driverId, vehicleId: vehicle.id } : {}),
      fromAddress: "SAI Airport", toAddress: "Validation hotel", direction: "AIRPORT_TO_CITY", tripType: "AIRPORT_TRANSFER",
      pickupAt: new Date(Date.now() + 86400000), passengers: 2, priceCents: 3000, status,
      statusHistory: { create: { status, note: "Validation fixture" } },
    } });
    const archive = (id, cookie = ctx.cookie) => request("/api/admin/bookings", "PATCH", { id, action: "ARCHIVE" }, cookie);
    const restore = id => request("/api/admin/bookings", "PATCH", { id, action: "RESTORE" }, ctx.cookie);
    const list = async archived => (await request(`/api/admin/bookings${archived ? "?archived=true" : ""}`, "GET", undefined, ctx.cookie)).data.bookings;

    const unassigned = await make("PENDING_PAYMENT");
    assert.equal((await request("/api/admin/bookings", "PATCH", { id: unassigned.id, action: "ARCHIVE" })).status, 403);
    for (const cookie of [customer.cookie, driver.cookie]) assert.equal((await archive(unassigned.id, cookie)).status, 403);
    assert.equal((await request("/api/bookings", "DELETE", { id: unassigned.id, action: "ARCHIVE" }, customer.cookie)).status, 400);
    assert.equal((await request("/api/driver/bookings", "PATCH", { id: unassigned.id, action: "ARCHIVE" }, driver.cookie)).status, 400);
    assert.equal((await archive("missing")).status, 404);
    assert.equal((await request("/api/admin/bookings", "PATCH", { id: unassigned.id, action: "ARCHIVE", status: "TRIP_COMPLETED" }, ctx.cookie)).status, 400);
    const removed = await archive(unassigned.id);
    assert.equal(removed.status, 200);
    assert.equal(removed.data.booking.status, "CANCELLED");
    assert.ok(removed.data.booking.adminArchivedAt);
    assert.ok(!(await list(false)).some(item => item.id === unassigned.id));
    assert.ok((await list(true)).some(item => item.id === unassigned.id));
    assert.equal((await archive(unassigned.id)).status, 409);
    assert.equal((await request("/api/admin/bookings", "PATCH", { id: unassigned.id, finalPriceCents: 1000, priceReason: "No edits to archive" }, ctx.cookie)).status, 409);
    assert.ok((await request("/api/bookings", "GET", undefined, customer.cookie)).data.bookings.some(item => item.id === unassigned.id && item.status === "CANCELLED"));
    const restored = await restore(unassigned.id);
    assert.equal(restored.status, 200);
    assert.equal(restored.data.booking.status, "CANCELLED", "Restoration must never reactivate a cancelled reservation");
    assert.equal(restored.data.booking.adminArchivedAt, null);
    assert.ok((await list(false)).some(item => item.id === unassigned.id));
    assert.ok(!(await list(true)).some(item => item.id === unassigned.id));
    assert.equal((await restore(unassigned.id)).status, 409);

    for (const status of ["CONFIRMED", "DRIVER_ASSIGNMENT_PENDING", "DRIVER_ASSIGNED", "DRIVER_ACCEPTED", "CANCELLED", "NO_SHOW", "REFUNDED"]) {
      const trip = await make(status);
      const archived = await archive(trip.id);
      assert.equal(archived.status, 200, status);
      assert.equal(archived.data.booking.status, ["CANCELLED", "NO_SHOW", "REFUNDED"].includes(status) ? status : "CANCELLED");
      assert.equal(archived.data.booking.driverId, trip.driverId);
      if (trip.driverId) {
        assert.ok((await request("/api/driver/bookings", "GET", undefined, driver.cookie)).data.bookings.some(item => item.id === trip.id && item.status === "CANCELLED"));
        assert.equal((await request("/api/driver/bookings", "PATCH", { id: trip.id, status: "DRIVER_ACCEPTED" }, driver.cookie)).status, 409);
      }
    }
    for (const status of ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"]) {
      const trip = await make(status);
      assert.equal((await archive(trip.id)).status, 409, "In-service trips require explicit cancellation");
      assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: trip.id } })).adminArchivedAt, null);
      assert.equal((await request("/api/admin/bookings", "DELETE", { id: trip.id, status: "CANCELLED" }, ctx.cookie)).status, 200);
      assert.equal((await archive(trip.id)).status, 200);
    }

    const completed = await make("TRIP_COMPLETED");
    const payment = await ctx.prisma.payment.create({ data: { bookingId: completed.id, provider: "DIRECT_DRIVER", status: "PAID", amountCents: 3000, currency: "USD", confirmedAt: new Date() } });
    const entry = await ctx.prisma.accountingEntry.create({ data: { sourceKey: `payment:${payment.id}`, type: "REVENUE", category: "TRIP", label: completed.reference, amountCents: 3000, currency: "USD", paidAt: new Date(), vehicleId: vehicle.id } });
    const history = await ctx.prisma.bookingStatusHistory.findMany({ where: { bookingId: completed.id } });
    const archivedCompleted = await archive(completed.id);
    assert.equal(archivedCompleted.status, 200);
    assert.equal(archivedCompleted.data.booking.status, "TRIP_COMPLETED");
    assert.deepEqual(await ctx.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } }), payment);
    assert.deepEqual(await ctx.prisma.accountingEntry.findUniqueOrThrow({ where: { id: entry.id } }), entry);
    assert.deepEqual(await ctx.prisma.bookingStatusHistory.findMany({ where: { bookingId: completed.id } }), history);
    assert.ok((await request("/api/bookings", "GET", undefined, customer.cookie)).data.bookings.some(item => item.id === completed.id && item.payments.some(p => p.status === "PAID")));
    assert.ok((await request("/api/driver/bookings", "GET", undefined, driver.cookie)).data.bookings.some(item => item.id === completed.id));
    const results = await Promise.all([restore(completed.id), restore(completed.id)]);
    assert.equal(results.filter(result => result.status === 200).length, 1);
    assert.equal(results.filter(result => result.status === 409).length, 1);
    assert.equal((await ctx.prisma.booking.findUniqueOrThrow({ where: { id: completed.id } })).status, "TRIP_COMPLETED");
    const audits = await ctx.prisma.auditLog.findMany({ where: { actorId: ctx.id, entityId: completed.id }, orderBy: { createdAt: "asc" } });
    assert.deepEqual(audits.map(item => item.action), ["ARCHIVE", "RESTORE"]);
  } finally { await ctx.cleanup(); }
});
