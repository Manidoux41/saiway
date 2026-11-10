import "server-only";
import type { Booking, Prisma, UserRole } from "@prisma/client";
import { movementPushIntervalMs, movingBetween, type PushKind } from "@/lib/push-policy";

async function enqueue(
  tx: Prisma.TransactionClient, where: Prisma.PushSubscriptionWhereInput,
  event: { kind: PushKind; bookingId?: string | null; driverId?: string | null; reference?: string; recipientRole: UserRole; eventKey: string },
) {
  const subscriptions = await tx.pushSubscription.findMany({ where: { AND: [where, { user: { status: "ACTIVE", role: event.recipientRole } }] }, select: { id: true } });
  if (subscriptions.length) await tx.pushDelivery.createMany({
    data: subscriptions.map(({ id }) => ({
      ...event, subscriptionId: id,
      expiresAt: new Date(Date.now() + (event.kind === "MOVING" ? 60_000 : 15 * 60_000)),
    })),
    skipDuplicates: true,
  });
}

export async function enqueueBookingPush(tx: Prisma.TransactionClient, booking: Booking, previous?: Pick<Booking, "status" | "driverId">) {
  if (previous && previous.status === booking.status && previous.driverId === booking.driverId) return;
  const eventKey = `booking:${booking.id}:${booking.status}:${booking.driverId ?? "none"}:${booking.updatedAt.toISOString()}`;
  if (!previous && booking.originType !== "DRIVER") {
    const receivedKey = `booking:${booking.id}:received`;
    if (booking.customerId) await enqueue(tx, { userId: booking.customerId }, { eventKey: receivedKey, kind: "BOOKED", bookingId: booking.id, reference: booking.reference, recipientRole: "CUSTOMER" });
    await enqueue(tx, {}, { eventKey: receivedKey, kind: booking.originType === "GUEST" ? "GUEST_REQUEST" : "NEW_BOOKING", bookingId: booking.id, reference: booking.reference, recipientRole: "ADMIN" });
  }
  if ((booking.status === "DRIVER_ASSIGNED" || booking.originType === "GUEST" && booking.status === "DRIVER_ACCEPTED") && booking.driverId && (!previous || previous.driverId !== booking.driverId)) {
    const driver = await tx.driverProfile.findUniqueOrThrow({ where: { id: booking.driverId }, select: { userId: true } });
    await enqueue(tx, { userId: driver.userId }, { eventKey, kind: "ASSIGNED", bookingId: booking.id, driverId: booking.driverId, reference: booking.reference, recipientRole: "DRIVER" });
    await enqueue(tx, {}, { eventKey, kind: "DISPATCHED", bookingId: booking.id, driverId: booking.driverId, reference: booking.reference, recipientRole: "ADMIN" });
  }
  if (booking.status === "DRIVER_ARRIVED" && booking.customerId) {
    await enqueue(tx, { userId: booking.customerId }, { eventKey, kind: "ARRIVED", bookingId: booking.id, driverId: booking.driverId, reference: booking.reference, recipientRole: "CUSTOMER" });
  }
  const kind = ({ DRIVER_EN_ROUTE: "EN_ROUTE", TRIP_STARTED: "STARTED", TRIP_COMPLETED: "COMPLETED" } as const)[booking.status as "DRIVER_EN_ROUTE" | "TRIP_STARTED" | "TRIP_COMPLETED"];
  if (kind) await enqueue(tx, {}, { eventKey, kind, bookingId: booking.id, driverId: booking.driverId, reference: booking.reference, recipientRole: "ADMIN" });
}

export async function enqueueMovementPush(tx: Prisma.TransactionClient, driverId: string, recordedAt: Date, current: { latitude: number; longitude: number; accuracy?: number | null }) {
  const cutoff = new Date(recordedAt.getTime() - movementPushIntervalMs);
  const earlier = await tx.driverLocation.findFirst({
    where: { driverId, recordedAt: { lte: cutoff, gte: new Date(cutoff.getTime() - 60_000) } },
    orderBy: { recordedAt: "desc" }, select: { latitude: true, longitude: true, accuracy: true },
  });
  if (!earlier || !movingBetween(
    { latitude: Number(earlier.latitude), longitude: Number(earlier.longitude), accuracy: earlier.accuracy === null ? null : Number(earlier.accuracy) },
    { ...current, accuracy: current.accuracy ?? null },
  )) return;
  const claimed = await tx.driverProfile.updateMany({
    where: { id: driverId, OR: [{ lastMovementPushAt: null }, { lastMovementPushAt: { lte: cutoff } }] },
    data: { lastMovementPushAt: recordedAt },
  });
  if (!claimed.count) return;
  await enqueue(tx, {}, { eventKey: `moving:${driverId}:${recordedAt.toISOString()}`, kind: "MOVING", driverId, recipientRole: "ADMIN" });
}

export async function enqueueAvailabilityPush(tx: Prisma.TransactionClient, driver: { id: string; isAvailable: boolean; updatedAt: Date }) {
  await enqueue(tx, {}, { eventKey: `availability:${driver.id}:${driver.updatedAt.toISOString()}`, kind: driver.isAvailable ? "AVAILABLE" : "UNAVAILABLE", driverId: driver.id, recipientRole: "ADMIN" });
}
