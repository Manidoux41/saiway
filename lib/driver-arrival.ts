import "server-only";
import type { Prisma } from "@prisma/client";
import { parseCoordinateAddress } from "@/lib/booking-location";
import { arrivalConfirmed, arrivalWindowMs } from "@/lib/arrival-policy";
import { routeDetailsSchema } from "@/lib/route-details";
import { enqueueBookingPush } from "@/lib/push-events";

export async function detectDriverArrival(tx: Prisma.TransactionClient, bookingId: string, driverId: string, actorId: string, recordedAt: Date) {
  if (Date.now() - recordedAt.getTime() > 10_000) return;
  const booking = await tx.booking.findFirst({ where: { id: bookingId, driverId, status: "DRIVER_EN_ROUTE" } });
  if (!booking) return;
  const route = routeDetailsSchema.safeParse(booking.routeDetails);
  const pickup = parseCoordinateAddress(booking.fromAddress) ?? (route.success ? route.data.from : null);
  // Free-text/geocoder guesses are not precise enough to announce a 50 m arrival.
  if (!pickup) return;
  const since = new Date(Math.max(booking.updatedAt.getTime(), recordedAt.getTime() - arrivalWindowMs));
  const fixes = await tx.driverLocation.findMany({
    where: { bookingId, driverId, recordedAt: { gte: since, lte: recordedAt } },
    orderBy: [{ recordedAt: "asc" }, { id: "asc" }],
    select: { latitude: true, longitude: true, accuracy: true, recordedAt: true },
  });
  if (!arrivalConfirmed(pickup, fixes.map((fix) => ({
    latitude: Number(fix.latitude), longitude: Number(fix.longitude),
    accuracy: fix.accuracy === null ? null : Number(fix.accuracy), recordedAt: fix.recordedAt,
  })), recordedAt)) return;
  const changed = await tx.booking.updateMany({
    where: { id: bookingId, driverId, status: "DRIVER_EN_ROUTE", updatedAt: booking.updatedAt },
    data: { status: "DRIVER_ARRIVED" },
  });
  if (!changed.count) return;
  await tx.bookingStatusHistory.create({ data: { bookingId, status: "DRIVER_ARRIVED", note: "GPS confirmed driver arrival" } });
  await tx.auditLog.create({
    data: { actorId, entity: "Booking", entityId: bookingId, action: "AUTO_ARRIVAL", metadata: { status: "DRIVER_ARRIVED", radiusMeters: 50, accuracyMeters: 20, dwellSeconds: 15 } },
  });
  const arrived = await tx.booking.findUniqueOrThrow({ where: { id: bookingId } });
  await enqueueBookingPush(tx, arrived, booking);
}
