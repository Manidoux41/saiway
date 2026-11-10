import "server-only";
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { coordinateAddress } from "@/lib/booking-location";
import { automaticDriver, assertDispatchSlot, DispatchError, dispatchTransaction } from "@/lib/driver-dispatch";
import { plannedDispatchEnd } from "@/lib/dispatch-policy";
import { enqueueBookingPush } from "@/lib/push-events";
import { schedulePushDelivery } from "@/lib/push-delivery";
import { freshGuestGps, guestCancellableStatuses, guestClosedStatuses, guestGpsSchema } from "@/lib/guest-ride-policy";

const lifetimeSeconds = 7 * 86400;
const headers = { "Cache-Control": "no-store", "Vary": "Cookie" };
const cookieName = "saiway_guest_ride";
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const tokenFrom = (request: Request) => request.headers.get("cookie")?.match(/(?:^|;\s*)saiway_guest_ride=([a-f0-9]{64})(?:;|$)/)?.[1] ?? null;
function cookie(token: string) {
  return `${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${lifetimeSeconds}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...headers, ...extra } });
}
function sameOrigin(request: Request) {
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") || expected.host;
  if (process.env.VERCEL && request.headers.get("x-forwarded-proto") === "https") expected.protocol = "https:";
  return request.headers.get("sec-fetch-site") !== "cross-site"
    && (!request.headers.get("origin") || request.headers.get("origin") === expected.origin);
}
class GuestRideError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
function failure(error: unknown) {
  if (error instanceof GuestRideError) return json({ error: error.code }, error.status, error.status === 429 ? { "Retry-After": "600" } : {});
  if (error instanceof SyntaxError) return json({ error: "INVALID_GPS" }, 400);
  if (error instanceof DispatchError || error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002", "P2025"].includes(error.code)) return json({ error: "CONFLICT" }, 409);
  console.error("Guest ride service failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : "UNKNOWN" });
  return json({ error: "UNAVAILABLE" }, 503);
}
const guestInclude = {
  booking: { include: {
    driver: { select: { user: { select: { name: true } } } },
    vehicle: { select: { name: true, plate: true } },
  } },
} satisfies Prisma.GuestRideAccessInclude;

async function findAccess(token: string) {
  return prisma.guestRideAccess.findFirst({ where: { tokenHash: tokenHash(token), expiresAt: { gt: new Date() } }, include: guestInclude });
}
async function view(access: NonNullable<Awaited<ReturnType<typeof findAccess>>>) {
  const trip = access.booking;
  const point = trip.driverId && ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"].includes(trip.status)
    ? await prisma.driverLocation.findFirst({ where: { bookingId: trip.id, driverId: trip.driverId }, orderBy: { recordedAt: "desc" }, select: { latitude: true, longitude: true, recordedAt: true } }) : null;
  return {
    reference: trip.reference, status: trip.status, fromAddress: trip.fromAddress,
    toAddress: trip.pricingStatus === "AWAITING_DESTINATION" ? null : trip.toAddress,
    priceCents: trip.pricingStatus === "AWAITING_DESTINATION" ? null : trip.priceCents,
    currency: trip.currency, driverName: trip.driver?.user.name ?? null, vehicle: trip.vehicle,
    location: point ? { latitude: Number(point.latitude), longitude: Number(point.longitude), recordedAt: point.recordedAt } : null,
  };
}
async function throttle(tx: Prisma.TransactionClient, request: Request) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be configured");
  const now = Date.now();
  const window = Math.floor(now / 600_000);
  // Only trust the platform-provided IP header on Vercel; elsewhere use a shared limit.
  const ip = process.env.VERCEL ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : null;
  const keys = [{ key: `guest:global:${window}`, max: 100 }, ...(ip ? [{ key: `guest:network:${createHmac("sha256", process.env.AUTH_SECRET).update(`${window}:${ip}`).digest("hex")}`, max: 5 }] : [])];
  await tx.guestRideLimit.deleteMany({ where: { expiresAt: { lt: new Date(now) } } });
  for (const limit of keys) {
    const row = await tx.guestRideLimit.upsert({ where: { key: limit.key }, create: { key: limit.key, attempts: 1, expiresAt: new Date((window + 2) * 600_000) }, update: { attempts: { increment: 1 } } });
    if (row.attempts > limit.max) throw new GuestRideError("RATE_LIMIT", 429);
  }
}
export async function guestRideSession(request: Request) {
  try {
    if (!sameOrigin(request)) return json({ error: "FORBIDDEN" }, 403);
    const previous = tokenFrom(request);
    if (request.method === "POST" && previous) {
      const access = await findAccess(previous);
      if (access && !guestClosedStatuses.includes(access.booking.status)) return json({ error: "ACTIVE_REQUEST" }, 409);
    }
    const token = request.method === "GET" && previous ? previous : randomBytes(32).toString("hex");
    return json({ ready: true }, 200, token === previous ? {} : { "Set-Cookie": cookie(token) });
  } catch (error) { return failure(error); }
}
export async function guestRideRequest(request: Request) {
  try {
    if (request.method !== "GET" && !sameOrigin(request)) return json({ error: "FORBIDDEN" }, 403);
    const token = tokenFrom(request);
    if (!token) return json({ error: "SESSION_REQUIRED" }, 401);
    const access = await findAccess(token);
    if (request.method === "GET") return json({ booking: access ? await view(access) : null });
    if (request.method === "DELETE") {
      if (!access) return json({ error: "NOT_FOUND" }, 404);
      await dispatchTransaction(async (tx) => {
        const existing = await tx.booking.findUniqueOrThrow({ where: { id: access.bookingId } });
        if (existing.status === "CANCELLED") return;
        if (!guestCancellableStatuses.includes(existing.status)) throw new GuestRideError("CANNOT_CANCEL", 409);
        const updated = await tx.booking.update({ where: { id: existing.id, updatedAt: existing.updatedAt }, data: { status: "CANCELLED", statusHistory: { create: { status: "CANCELLED", note: "GUEST cancellation from private browser session" } } } });
        await tx.auditLog.create({ data: { entity: "Booking", entityId: existing.id, action: "GUEST_CANCEL" } });
        await enqueueBookingPush(tx, updated, existing);
      });
      schedulePushDelivery();
      const updated = await findAccess(token);
      if (!updated) throw new GuestRideError("NOT_FOUND", 404);
      return json({ booking: await view(updated) });
    }
    if (access) return json({ booking: await view(access) });
    if (Number(request.headers.get("content-length") ?? 0) > 2000) return json({ error: "INVALID_GPS" }, 413);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "INVALID_GPS" }, 415);
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: "INVALID_GPS" }, 413);
    const parsed = guestGpsSchema.safeParse(JSON.parse(raw));
    if (!parsed.success || !freshGuestGps(parsed.data.capturedAt)) return json({ error: "INVALID_GPS" }, 400);
    const hash = tokenHash(token);
    await dispatchTransaction(async (tx) => {
      if (await tx.guestRideAccess.findUnique({ where: { tokenHash: hash } })) return;
      await throttle(tx, request);
      const pickupAt = new Date();
      let trip = await tx.booking.create({ data: {
        reference: `SW-${randomUUID().toUpperCase()}`, originType: "GUEST", fromAddress: coordinateAddress(parsed.data),
        toAddress: "Destination to be agreed with driver", direction: "AIRPORT_TO_CITY", tripType: "CITY_TRANSFER",
        pickupAt, passengers: 1, priceCents: 0, pricingStatus: "AWAITING_DESTINATION", paymentMethod: "DRIVER", status: "DRIVER_ASSIGNMENT_PENDING",
        dispatchEndsAt: plannedDispatchEnd({ pickupAt, tripType: "CITY_TRANSFER", routeDetails: null, fareDetails: null }),
        guestAccess: { create: { tokenHash: hash, expiresAt: new Date(Date.now() + lifetimeSeconds * 1000) } },
      } });
      const selected = await automaticDriver(tx, trip);
      if (selected && selected.distanceMeters !== null) {
        trip = await tx.booking.update({ where: { id: trip.id }, data: { driverId: selected.driverId, vehicleId: selected.vehicleId, status: "DRIVER_ASSIGNED" } });
        await assertDispatchSlot(tx, trip);
      }
      await tx.bookingStatusHistory.create({ data: { bookingId: trip.id, status: trip.status, note: "GUEST GPS-only request; destination, capacity and fare must be confirmed before departure" } });
      await tx.auditLog.create({ data: { entity: "Booking", entityId: trip.id, action: "GUEST_REQUEST", metadata: { automaticallyAssigned: Boolean(trip.driverId), gpsAccuracy: parsed.data.accuracy } } });
      await enqueueBookingPush(tx, trip);
    });
    schedulePushDelivery();
    const created = await findAccess(token);
    if (!created) throw new GuestRideError("SESSION_REQUIRED", 401);
    return json({ booking: await view(created) }, 201);
  } catch (error) { return failure(error); }
}
