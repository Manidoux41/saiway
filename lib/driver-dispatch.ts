import "server-only";
import { Prisma, type Booking } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { dispatchClosedStatuses, dispatchDistance, dispatchOverlaps, dispatchPickup, dispatchWindow, inServiceStatuses } from "@/lib/dispatch-policy";

export class DispatchError extends Error {
  constructor(message: string, readonly status = 409) { super(message); }
}

function writeConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return true;
  return error instanceof Error && error.name === "DriverAdapterError"
    && typeof error.cause === "object" && error.cause !== null
    && "kind" in error.cause && error.cause.kind === "TransactionWriteConflict";
}

export async function dispatchTransaction<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15_000 });
    } catch (error) {
      if (!writeConflict(error)) throw error;
      if (attempt >= 2) throw new DispatchError("Concurrent dispatch update; refresh and retry");
    }
  }
}

export async function assertDispatchSlot(tx: Prisma.TransactionClient, trip: Booking, now = new Date()) {
  if (!trip.driverId && !trip.vehicleId) return;
  const window = dispatchWindow(trip, now);
  const reservations = await tx.booking.findMany({
    where: {
      id: { not: trip.id }, status: { notIn: dispatchClosedStatuses },
      OR: [...(trip.driverId ? [{ driverId: trip.driverId }] : []), ...(trip.vehicleId ? [{ vehicleId: trip.vehicleId }] : [])],
      AND: [{ OR: [{ pickupAt: { lt: window.end } }, { status: { in: inServiceStatuses } }] }],
    },
  });
  if (reservations.some((other) => dispatchOverlaps(window, dispatchWindow(other, now)))) throw new DispatchError("Driver or vehicle already reserved for this time");
}

export async function automaticDriver(tx: Prisma.TransactionClient, trip: Booking) {
  const now = new Date();
  const window = dispatchWindow(trip, now);
  const pickup = dispatchPickup(trip);
  const drivers = await tx.driverProfile.findMany({
    where: { isAvailable: true, user: { role: "DRIVER", status: "ACTIVE" }, selectedVehicle: { active: true, seats: { gte: trip.passengers } } },
    include: { selectedVehicle: true, locations: { orderBy: { recordedAt: "desc" }, take: 1 } },
    orderBy: [{ availableSince: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  if (!drivers.length) return null;
  const reservations = await tx.booking.findMany({
    where: {
      id: { not: trip.id }, status: { notIn: dispatchClosedStatuses },
      OR: [{ driverId: { in: drivers.map((driver) => driver.id) } }, { vehicleId: { in: drivers.flatMap((driver) => driver.selectedVehicleId ? [driver.selectedVehicleId] : []) } }],
      AND: [{ OR: [{ pickupAt: { lt: window.end } }, { status: { in: inServiceStatuses } }] }],
    },
  });
  const compatible = drivers.filter((driver) => !reservations.some((other) =>
    (other.driverId === driver.id || other.vehicleId === driver.selectedVehicleId) && (dispatchOverlaps(window, dispatchWindow(other, now))
      || trip.originType === "GUEST" && other.pickupAt <= now && ["DRIVER_ASSIGNED", "DRIVER_ACCEPTED", ...inServiceStatuses].includes(other.status)),
  )).map((driver) => {
    const location = driver.locations[0];
    return { driver, distance: dispatchDistance(pickup, location ? { latitude: Number(location.latitude), longitude: Number(location.longitude), accuracy: location.accuracy === null ? null : Number(location.accuracy), recordedAt: location.recordedAt } : null, now) };
  });
  if (trip.originType !== "GUEST") compatible.sort((first, second) => first.distance === second.distance ? 0 : first.distance - second.distance);
  const selected = compatible[0];
  if (!selected) return null;
  return { driverId: selected.driver.id, vehicleId: selected.driver.selectedVehicleId!, distanceMeters: Number.isFinite(selected.distance) ? Math.round(selected.distance) : null };
}
