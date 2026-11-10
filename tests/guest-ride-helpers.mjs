import { assert, request, createAccount } from "./helpers.mjs";
export const gpsInput = () => ({ latitude: 13.3601234, longitude: 103.8501234, accuracy: 10, capturedAt: new Date().toISOString() });
export async function guestSession() {
  const result = await request("/api/guest-rides/session");
  assert.equal(result.status, 200);
  assert.ok(result.cookie?.startsWith("saiway_guest_ride="));
  assert.match(result.setCookie, /HttpOnly/);
  assert.match(result.setCookie, /SameSite=Lax/);
  return result.cookie;
}
export async function guestDriver(ctx, suffix = "driver") {
  const user = await createAccount(ctx, "DRIVER", suffix);
  const profile = await ctx.prisma.driverProfile.findUniqueOrThrow({ where: { userId: user.id } });
  const vehicle = await ctx.prisma.vehicle.create({ data: { name: ctx.prefix, plate: `${ctx.prefix}-${suffix}`, seats: 4, iconCategory: "SEDAN" } });
  assert.equal((await request("/api/driver/availability", "PATCH", { isAvailable: true, selectedVehicleId: vehicle.id }, user.cookie)).status, 200);
  await ctx.prisma.driverLocation.create({ data: { driverId: profile.id, latitude: 13.3601234, longitude: 103.8501234, accuracy: 5 } });
  return { ...user, profile, vehicle };
}
export async function cleanupGuest(ctx, references) {
  const rows = await ctx.prisma.booking.findMany({ where: { reference: { in: references } }, select: { id: true } });
  const ids = rows.map((row) => row.id);
  await ctx.prisma.accountingEntry.deleteMany({ where: { sourceKey: { in: (await ctx.prisma.payment.findMany({ where: { bookingId: { in: ids } }, select: { id: true } })).map((row) => `payment:${row.id}`) } } });
  await ctx.prisma.auditLog.deleteMany({ where: { entityId: { in: ids } } });
  await ctx.prisma.driverLocation.deleteMany({ where: { bookingId: { in: ids } } });
  await ctx.prisma.booking.deleteMany({ where: { id: { in: ids } } });
  await ctx.cleanup();
}
