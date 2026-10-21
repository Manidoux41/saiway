import "server-only";
import type { BookingStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { activeAccount, authorize } from "@/lib/access";

export const trackingStatuses: BookingStatus[] = ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"];
const minIntervalMs = 2_000;
const noStore = { "Cache-Control": "no-store" };
const position = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative().max(100_000).nullable().optional(),
}).strict();

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

export async function shareTripLocation(request: Request, bookingId: string) {
  try {
    const account = await authorize(request, "DRIVER");
    if (!account) return json({ error: "Driver access required" }, 403);
    const booking = await prisma.booking.findFirst({ where: { id: bookingId, driver: { userId: account.id } }, select: { id: true, status: true, driverId: true } });
    if (!booking?.driverId) return json({ error: "Booking not found" }, 404);
    if (!trackingStatuses.includes(booking.status)) return json({ error: "Location sharing starts when the driver departs" }, 409);
    const parsed = position.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Invalid coordinates" }, 400);
    const latest = await prisma.driverLocation.findFirst({ where: { bookingId }, orderBy: { recordedAt: "desc" }, select: { recordedAt: true } });
    if (latest && Date.now() - latest.recordedAt.getTime() < minIntervalMs) return json({ accepted: false }, 202);
    const { latitude, longitude, accuracy } = parsed.data;
    // Only the latest point is kept: the customer needs the current position, not a movement history.
    const [, saved] = await prisma.$transaction([
      prisma.driverLocation.deleteMany({ where: { bookingId } }),
      prisma.driverLocation.create({ data: { bookingId, driverId: booking.driverId, latitude, longitude, accuracy: accuracy ?? null }, select: { recordedAt: true } }),
    ]);
    return json({ accepted: true, recordedAt: saved.recordedAt });
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: "Invalid JSON" }, 400);
    console.error("Trip location update failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Location service unavailable" }, 503);
  }
}

export async function readTripLocation(request: Request, bookingId: string) {
  try {
    const account = await activeAccount(request);
    if (!account) return json({ error: "Sign in required" }, 401);
    const scope = account.role === "ADMIN" ? {} : account.role === "CUSTOMER" ? { customerId: account.id } : { driver: { userId: account.id } };
    const booking = await prisma.booking.findFirst({
      where: { ...scope, id: bookingId },
      select: { id: true, reference: true, status: true, fromAddress: true, toAddress: true, pickupAt: true, driver: { select: { user: { select: { name: true } } } }, vehicle: { select: { name: true, plate: true } } },
    });
    if (!booking) return json({ error: "Booking not found" }, 404);
    const tracking = trackingStatuses.includes(booking.status);
    const point = tracking ? await prisma.driverLocation.findFirst({ where: { bookingId }, orderBy: { recordedAt: "desc" } }) : null;
    return json({
      booking: { id: booking.id, reference: booking.reference, status: booking.status, fromAddress: booking.fromAddress, toAddress: booking.toAddress, pickupAt: booking.pickupAt, driverName: booking.driver?.user.name ?? null, vehicle: booking.vehicle },
      tracking,
      location: point ? { latitude: Number(point.latitude), longitude: Number(point.longitude), accuracy: point.accuracy === null ? null : Number(point.accuracy), recordedAt: point.recordedAt } : null,
    });
  } catch (error) {
    console.error("Trip location read failed", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "Location service unavailable" }, 503);
  }
}
