import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import { customerLocationStatuses, trackingStatuses } from "@/lib/trip-location";
import { routeDetailsSchema } from "@/lib/route-details";
import { coordinateAddress } from "@/lib/booking-location";
import { enqueueMovementPush } from "@/lib/push-events";
import { schedulePushDelivery } from "@/lib/push-delivery";
import { detectDriverArrival } from "@/lib/driver-arrival";
import { metersBetween } from "@/lib/arrival-policy";
import { driverPositionSchema } from "@/lib/driver-location-input";

const noStore = { "Cache-Control": "no-store" };
const minIntervalMs = 2_000;

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

function unavailable(error: unknown) {
  console.error("Driver location service failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
  return json({ error: "Location service unavailable" }, 503);
}

export async function driverLocationAccess(request: Request) {
  try {
    const account = await authorize(request, "DRIVER");
    if (!account) return json({ error: "Driver access required" }, 403);
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: account.id },
      select: {
        id: true, isAvailable: true, returningToHub: true,
        selectedVehicle: { select: { id: true, name: true, plate: true, iconCategory: true } },
        bookings: { where: { status: { in: customerLocationStatuses } }, select: { id: true, status: true, fromAddress: true, toAddress: true, vehicle: { select: { id: true, name: true, plate: true, iconCategory: true } } }, orderBy: [{ status: "desc" }, { pickupAt: "asc" }], take: 1 },
        locations: { orderBy: { recordedAt: "desc" }, take: 1, select: { latitude: true, longitude: true, accuracy: true, heading: true, recordedAt: true } },
      },
    });
    if (!driver) return json({ error: "Driver profile not found" }, 404);
    const hubs = await prisma.hub.findMany({ where: { active: true }, select: { id: true, name: true, address: true, latitude: true, longitude: true } });
    const activeBooking = driver.bookings[0] ?? null;
    const returnVehicle = !activeBooking ? await prisma.booking.findFirst({
      where: { driverId: driver.id, status: "TRIP_COMPLETED", vehicleId: { not: null } },
      orderBy: { updatedAt: "desc" },
      select: { vehicle: { select: { id: true, name: true, plate: true, iconCategory: true } } },
    }) : null;
    const latest = driver.locations[0];
    return json({
      enabled: driver.isAvailable || driver.returningToHub || driver.bookings.length > 0,
      returningToHub: driver.returningToHub,
      booking: activeBooking,
      vehicle: activeBooking?.vehicle ?? driver.selectedVehicle ?? returnVehicle?.vehicle ?? null,
      location: latest ? { latitude: Number(latest.latitude), longitude: Number(latest.longitude), accuracy: latest.accuracy === null ? null : Number(latest.accuracy), heading: latest.heading === null ? null : Number(latest.heading), recordedAt: latest.recordedAt } : null,
      hubs: hubs.map((hub) => ({ ...hub, latitude: Number(hub.latitude), longitude: Number(hub.longitude) })),
    });
  } catch (error) { return unavailable(error); }
}

export async function shareDriverLocation(request: Request) {
  try {
    const account = await authorize(request, "DRIVER");
    if (!account) return json({ error: "Driver access required" }, 403);
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
    const parsed = driverPositionSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Invalid coordinates" }, 400);
    const driver = await prisma.driverProfile.findUnique({
      where: { userId: account.id },
      select: { id: true, isAvailable: true, returningToHub: true, bookings: { where: { status: { in: customerLocationStatuses } }, select: { id: true, status: true }, orderBy: [{ status: "desc" }, { pickupAt: "asc" }], take: 1 } },
    });
    if (!driver) return json({ error: "Driver profile not found" }, 404);
    const booking = driver.bookings[0] ?? null;
    if (!driver.isAvailable && !driver.returningToHub && !booking) return json({ error: "Location sharing is only available while on duty" }, 409);

    const latest = await prisma.driverLocation.findFirst({ where: { driverId: driver.id }, orderBy: { recordedAt: "desc" }, select: { recordedAt: true } });
    if (latest && (Date.now() - latest.recordedAt.getTime() < minIntervalMs || parsed.data.capturedAt && parsed.data.capturedAt <= latest.recordedAt)) return json({ accepted: false, recordedAt: latest.recordedAt }, 202);

    const saved = await prisma.$transaction(async (tx) => {
      const location = await tx.driverLocation.create({
        data: {
          driverId: driver.id,
          bookingId: booking?.id ?? null,
          latitude: parsed.data.latitude,
          longitude: parsed.data.longitude,
          accuracy: parsed.data.accuracy ?? null,
          heading: parsed.data.heading ?? null,
          recordedAt: parsed.data.capturedAt,
        },
        select: { recordedAt: true },
      });
      if (booking) await detectDriverArrival(tx, booking.id, driver.id, account.id, location.recordedAt);
      await enqueueMovementPush(tx, driver.id, location.recordedAt, parsed.data);
      return location;
    });
    schedulePushDelivery();

    let returningToHub = driver.returningToHub;
    if (returningToHub && !booking) {
      const hubs = await prisma.hub.findMany({ where: { active: true }, select: { latitude: true, longitude: true } });
      const arrived = hubs.some((hub) => metersBetween(parsed.data, { latitude: Number(hub.latitude), longitude: Number(hub.longitude) }) <= 100);
      if (arrived) {
        await prisma.driverProfile.update({ where: { id: driver.id }, data: { returningToHub: false } });
        returningToHub = false;
      }
    }

    return json({ accepted: true, recordedAt: saved.recordedAt, bookingId: booking?.id ?? null, returningToHub });
  } catch (error) { return unavailable(error); }
}

export async function adminFleetLocations(request: Request) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return json({ error: "Administrator access required" }, 403);
    const now = new Date();
    const freshSince = new Date(now.getTime() - 2 * 60_000);
    const [drivers, hubs] = await Promise.all([
      prisma.driverProfile.findMany({
        where: {
          user: { status: "ACTIVE" },
        },
        select: {
          id: true,
          isAvailable: true,
          returningToHub: true,
          selectedVehicle: { select: { id: true, name: true, plate: true, iconCategory: true } },
          user: { select: { name: true } },
          locations: { orderBy: { recordedAt: "desc" }, take: 1 },
          bookings: {
            where: { status: { in: customerLocationStatuses } },
            orderBy: [{ status: "desc" }, { pickupAt: "asc" }],
            take: 1,
            select: { id: true, reference: true, status: true, fromAddress: true, toAddress: true, routeDetails: true, vehicle: { select: { id: true, name: true, plate: true, iconCategory: true } } },
          },
        },
      }),
      prisma.hub.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, address: true, latitude: true, longitude: true } }),
    ]);
    const driversWithoutActiveVehicle = drivers.filter((driver) => !driver.bookings[0] && (
      driver.returningToHub || Boolean(driver.locations[0] && driver.locations[0].recordedAt >= freshSince)
    ));
    const lastVehicles = new Map(await Promise.all(driversWithoutActiveVehicle.map(async (driver) => {
      const completed = await prisma.booking.findFirst({
        where: { driverId: driver.id, status: "TRIP_COMPLETED", vehicleId: { not: null } },
        orderBy: { updatedAt: "desc" },
        select: { vehicle: { select: { id: true, name: true, plate: true, iconCategory: true } } },
      });
      return [driver.id, completed?.vehicle ?? null] as const;
    })));

    return json({
      updatedAt: now,
      hubs: hubs.map((hub) => ({ ...hub, latitude: Number(hub.latitude), longitude: Number(hub.longitude) })),
      drivers: drivers.map((driver) => {
        const latest = driver.locations[0];
        const location = latest && latest.recordedAt >= freshSince && (driver.isAvailable || driver.returningToHub || driver.bookings.length > 0) ? {
          latitude: Number(latest.latitude),
          longitude: Number(latest.longitude),
          accuracy: latest.accuracy === null ? null : Number(latest.accuracy),
          heading: latest.heading === null ? null : Number(latest.heading),
          recordedAt: latest.recordedAt,
        } : null;
        const booking = driver.bookings[0] ?? null;
        const status = booking?.status === "TRIP_STARTED" ? "ON_TRIP"
          : booking && trackingStatuses.includes(booking.status) ? "TO_PICKUP"
            : booking ? "ASSIGNED"
              : driver.returningToHub ? "RETURNING_TO_HUB" : driver.isAvailable ? "AVAILABLE" : "UNAVAILABLE";
        const nearestHub = !booking && status === "RETURNING_TO_HUB" && location
          ? hubs.reduce<typeof hubs[number] | null>((nearest, hub) => {
              if (!nearest) return hub;
              return metersBetween(location, { latitude: Number(hub.latitude), longitude: Number(hub.longitude) }) < metersBetween(location, { latitude: Number(nearest.latitude), longitude: Number(nearest.longitude) }) ? hub : nearest;
            }, null)
            : null;
        const saved = booking?.routeDetails ? routeDetailsSchema.parse(booking.routeDetails) : null;
        const target = booking
          ? { address: saved ? coordinateAddress(status === "ON_TRIP" ? saved.to : saved.from) : status === "ON_TRIP" ? booking.toAddress : booking.fromAddress, hub: null }
          : nearestHub
            ? { address: null, hub: { id: nearestHub.id, name: nearestHub.name, address: nearestHub.address, latitude: Number(nearestHub.latitude), longitude: Number(nearestHub.longitude) } }
            : null;
        return {
          id: driver.id,
          name: driver.user.name,
          status,
          location,
          booking: booking ? { id: booking.id, reference: booking.reference, status: booking.status } : null,
          vehicle: booking?.vehicle ?? driver.selectedVehicle ?? lastVehicles.get(driver.id) ?? null,
          target,
          stale: Boolean(latest && !location),
        };
      }),
    });
  } catch (error) { return unavailable(error); }
}
