import { randomUUID } from "node:crypto";
import { BookingStatus, Prisma, TripDirection, TripType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import type { SessionRole } from "@/lib/auth-session";
import { parseCoordinateAddress } from "@/lib/booking-location";
import { circuitSchema, distanceBetween, extraTourHours, fareDetailsSchema, farePolicy, farePolicyKey, measuredDistance, priceFare, type FareDetails } from "@/lib/fare-policy";
import { routeDistance } from "@/lib/fare-routing";

const text = z.string().trim().min(1).max(500);
const address = text.refine((value) => !/^GPS:/i.test(value) || parseCoordinateAddress(value) !== null, "Invalid GPS coordinates");
const nullableId = z.string().min(1).nullable().optional();
const details = z.object({
  fromAddress: address, toAddress: address,
  direction: z.enum(TripDirection), tripType: z.enum(TripType),
  pickupAt: z.iso.datetime({ offset: true }).refine((value) => new Date(value).getTime() > Date.now(), "Pickup must be in the future"),
  passengers: z.number().int().min(1).max(50),
  luggageCount: z.number().int().min(0).max(50).optional(),
  flightNumber: z.string().trim().max(100).optional(),
  pickupNotes: z.string().trim().max(2000).optional(),
  specialNeeds: z.string().trim().max(2000).optional(),
});
const adminCreate = details.extend({ customerId: text, driverId: nullableId, vehicleId: nullableId, priceCents: z.number().int().nonnegative().max(100000000) });
const customerCreate = details.extend({ paymentMethod: z.enum(["ONLINE", "DRIVER"]).optional(), contactPhone: z.string().trim().max(30).regex(/^\+?[\d\s().-]*$/, "Invalid phone number").optional(), tourCircuit: circuitSchema.optional(), tourHours: z.number().min(1).max(48).optional() });
const adminEdit = details.partial().extend({ id: text, pickupAt: z.iso.datetime({ offset: true }).optional(), driverId: nullableId, vehicleId: nullableId, priceCents: z.number().int().nonnegative().max(100000000).optional() });
const adminConfirm = z.object({ id: text, status: z.literal("CONFIRMED") }).strict();
const adminPatch = z.union([adminEdit.strict(), adminConfirm]);
const command = z.object({ id: text, status: z.enum(BookingStatus), confirmEstimatedDistance: z.boolean().optional(), tourCircuit: circuitSchema.optional() }).strict();
const walkupCreate = details.omit({ pickupAt: true }).extend({ customerEmail: z.email(), vehicleId: text }).strict();
const terminal: BookingStatus[] = ["CANCELLED", "TRIP_COMPLETED", "NO_SHOW", "REFUNDED"];
const driverTransitions: Partial<Record<BookingStatus, BookingStatus>> = {
  DRIVER_ASSIGNED: "DRIVER_ACCEPTED", DRIVER_ACCEPTED: "DRIVER_EN_ROUTE",
  DRIVER_EN_ROUTE: "DRIVER_ARRIVED", DRIVER_ARRIVED: "TRIP_STARTED", TRIP_STARTED: "TRIP_COMPLETED",
};
export const bookingInclude = {
  payments: { select: { status: true, provider: true, amountCents: true, currency: true, collectionMethod: true } },
  customer: { select: { id: true, name: true, email: true, phone: true } },
  driver: { select: { id: true, user: { select: { name: true } } } },
  vehicle: { select: { id: true, name: true, plate: true, seats: true, iconCategory: true } },
} satisfies Prisma.BookingInclude;

function isAirportTrip(value: { fromAddress: string; toAddress: string; tripType: TripType }) {
  return value.tripType !== "TOURIST_TOUR" && (value.tripType === "AIRPORT_TRANSFER" || [value.fromAddress, value.toAddress].some((address) => {
    const point = parseCoordinateAddress(address);
    return /^(SAI Airport|Siem Reap Angkor International Airport)/i.test(address)
      || Boolean(point && distanceBetween(point, { latitude: 13.3692, longitude: 104.2231 }) < 2000);
  }));
}

async function fare(value: { fromAddress: string; toAddress: string; tripType: TripType; tourCircuit?: z.infer<typeof circuitSchema>; tourHours?: number }) {
  const stored = await prisma.systemSetting.findUnique({ where: { key: farePolicyKey } });
  const policy = farePolicy(stored?.value);
  if (value.tripType === "TOURIST_TOUR" && value.tourCircuit === "REMOTE" && policy.remoteCircuitCents === null) throw new BookingError("Remote circuit price must be configured by an administrator", 422);
  const mode = value.tripType === "TOURIST_TOUR" ? "TOUR" : isAirportTrip(value) ? "AIRPORT" : "CITY";
  const bookedHours = value.tourHours ?? policy.tourIncludedHours;
  const snapshot: FareDetails = {
    mode, policy, distanceMeters: mode === "CITY" ? await routeDistance(value.fromAddress, value.toAddress) : null,
    distanceSource: mode === "CITY" ? "ROUTE" : "PACKAGE", circuit: mode === "TOUR" ? value.tourCircuit ?? "SMALL" : null,
    bookedHours, extraHours: mode === "TOUR" ? extraTourHours(bookedHours, 0, policy.tourIncludedHours) : 0, startedAt: null, finalized: false,
  };
  return { priceCents: priceFare(snapshot), currency: "USD", fareDetails: snapshot };
}

export async function bookingQuote(request: Request) {
  try {
    if (!await authorize(request, "CUSTOMER")) return Response.json({ error: "Customer access required" }, { status: 403 });
    const url = new URL(request.url);
    const selection = customerCreate.pick({ fromAddress: true, toAddress: true, direction: true, tripType: true, tourCircuit: true, tourHours: true }).safeParse({
      direction: url.searchParams.get("direction"), tripType: url.searchParams.get("tripType"),
      fromAddress: url.searchParams.get("fromAddress"), toAddress: url.searchParams.get("toAddress"),
      tourCircuit: url.searchParams.get("tourCircuit") ?? undefined,
      tourHours: url.searchParams.has("tourHours") ? Number(url.searchParams.get("tourHours")) : undefined,
    });
    if (!selection.success) return Response.json({ error: "Invalid route" }, { status: 400 });
    return Response.json(await fare(selection.data), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status });
    console.error("Booking quote unavailable");
    return Response.json({ error: "Pricing service unavailable" }, { status: 503 });
  }
}

class BookingError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

async function assignment(tx: Prisma.TransactionClient, driverId: string | null | undefined, vehicleId: string | null | undefined, passengers: number) {
  if (driverId) {
    const driver = await tx.driverProfile.findUnique({ where: { id: driverId }, include: { user: true } });
    if (!driver || driver.user.role !== "DRIVER" || driver.user.status !== "ACTIVE" || !driver.isAvailable) throw new BookingError("Select an active, available driver");
  }
  if (vehicleId) {
    const vehicle = await tx.vehicle.findUnique({ where: { id: vehicleId } });
    if (!vehicle?.active || vehicle.seats < passengers) throw new BookingError("Select an active vehicle with enough seats");
  }
}

export async function bookingRequest(request: Request, role: SessionRole) {
  try {
    const account = await authorize(request, role);
    if (!account) return Response.json({ error: `${role} access required` }, { status: 403 });
    const scope: Prisma.BookingWhereInput = role === "ADMIN" ? {} : role === "CUSTOMER" ? { customerId: account.id } : { driver: { userId: account.id } };
    if (request.method === "GET") {
      if (role === "DRIVER" && new URL(request.url).searchParams.get("walkupOptions") === "true") {
        const vehicles = await prisma.vehicle.findMany({ where: { active: true }, select: { id: true, name: true, plate: true, seats: true } });
        return Response.json({ vehicles }, { headers: { "Cache-Control": "no-store" } });
      }
      const bookings = await prisma.booking.findMany({ where: scope, include: bookingInclude, orderBy: { pickupAt: "asc" } });
      return Response.json({ bookings }, { headers: { "Cache-Control": "no-store" } });
    }
    const body: unknown = await request.json();
    if (request.method === "POST") {
      if (role === "DRIVER") {
        const input = walkupCreate.parse(body);
        if (input.tripType !== "CITY_TRANSFER") throw new BookingError("Walk-up trips must be city trips");
        const quote = await fare(input);
        const created = await prisma.$transaction(async (tx) => {
          const driver = await tx.driverProfile.findUniqueOrThrow({ where: { userId: account.id } });
          if (!driver.isAvailable) throw new BookingError("Driver must be available", 409);
          await tx.driverProfile.update({ where: { id: driver.id }, data: { returningToHub: false } });
          if (await tx.booking.count({ where: { driverId: driver.id, status: { in: ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"] } } })) throw new BookingError("Finish the current trip first", 409);
          if (await tx.booking.count({ where: { vehicleId: input.vehicleId, status: { in: ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"] } } })) throw new BookingError("Vehicle already in use", 409);
          const customer = await tx.user.findUnique({ where: { email: input.customerEmail.toLowerCase() } });
          if (!customer || customer.role !== "CUSTOMER" || customer.status !== "ACTIVE") throw new BookingError("Select an existing active customer");
          const vehicle = await tx.vehicle.findUnique({ where: { id: input.vehicleId } });
          if (!vehicle?.active || vehicle.seats < input.passengers) throw new BookingError("Invalid vehicle capacity");
          const latest = await tx.driverLocation.findFirst({ where: { driverId: driver.id }, orderBy: { recordedAt: "desc" } });
          if (!latest || Date.now() - latest.recordedAt.getTime() > 60000 || latest.accuracy === null || Number(latest.accuracy) > 50) throw new BookingError("A recent accurate driver GPS fix is required", 409);
          const startedAt = new Date();
          const { customerEmail, ...fields } = input; void customerEmail;
          const booking = await tx.booking.create({
            data: { ...fields, ...quote, fareDetails: { ...quote.fareDetails, startedAt: startedAt.toISOString() }, metered: true, reference: `SW-${randomUUID().toUpperCase()}`, customerId: customer.id, driverId: driver.id, pickupAt: startedAt, paymentMethod: "DRIVER", status: "TRIP_STARTED", statusHistory: { create: { status: "TRIP_STARTED", note: "Driver started unreserved city trip; final fare uses GPS distance" } } }, include: bookingInclude,
          });
          await tx.driverLocation.create({ data: { driverId: driver.id, bookingId: booking.id, latitude: latest.latitude, longitude: latest.longitude, accuracy: latest.accuracy, recordedAt: startedAt } });
          await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: booking.id, action: "START_METERED_TRIP" } });
          return booking;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return Response.json({ booking: created }, { status: 201 });
      }
      const parsed = role === "ADMIN" ? adminCreate.strict().safeParse(body) : customerCreate.strict().safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues.map((issue) => issue.message).join("; ") }, { status: 400 });
      const value = parsed.data;
      const admin = role === "ADMIN" ? adminCreate.parse(body) : null;
      const quote = admin ? { priceCents: admin.priceCents, currency: "USD" } : await fare(customerCreate.parse(value));
      if (admin && isAirportTrip(admin) && admin.priceCents > 3000) throw new BookingError("Airport transfers cannot exceed USD 30");
      if (!admin && quote.currency === "USD" && value.tripType === "TOURIST_TOUR" && customerCreate.parse(value).paymentMethod === "ONLINE") throw new BookingError("Tour supplements are settled with the driver; select pay at driver");
      const booking = await prisma.$transaction(async (tx) => {
        const customerId = admin?.customerId ?? account.id;
        const customer = await tx.user.findUnique({ where: { id: customerId } });
        if (customer?.role !== "CUSTOMER" || customer.status !== "ACTIVE") throw new BookingError("Select an active customer");
        await assignment(tx, admin?.driverId, admin?.vehicleId, value.passengers);
        const status: BookingStatus = admin?.driverId ? "DRIVER_ASSIGNED" : "PENDING_PAYMENT";
        const created = await tx.booking.create({
          data: { ...details.parse(value), ...(admin ? {} : (({ paymentMethod, contactPhone }) => ({ paymentMethod, contactPhone: contactPhone || null }))(customerCreate.parse(value))), customerId, reference: `SW-${randomUUID().toUpperCase()}`, pickupAt: new Date(value.pickupAt), ...quote, driverId: admin?.driverId, vehicleId: admin?.vehicleId, status, statusHistory: { create: { status, note: "Booking created; payment is tracked separately" } } },
          include: bookingInclude,
        });
        await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: created.id, action: "CREATE" } });
        return created;
      });
      return Response.json({ booking }, { status: 201 });
    }
    let confirmedRoute: number | null = null;
    const ending = command.safeParse(body);
    if (role === "DRIVER" && ending.success && ending.data.status === "TRIP_COMPLETED" && ending.data.confirmEstimatedDistance) {
      const own = await prisma.booking.findFirst({ where: { ...scope, id: ending.data.id, status: "TRIP_STARTED", metered: true } });
      if (!own) throw new BookingError("Active metered trip not found", 404);
      confirmedRoute = await routeDistance(own.fromAddress, own.toAddress);
    }
    const booking = await prisma.$transaction(async (tx) => {
      const parsed = request.method === "PATCH" && role === "ADMIN" ? adminPatch.safeParse(body) : command.safeParse(body);
      if (!parsed.success) throw new BookingError("Invalid booking update");
      const existing = await tx.booking.findFirst({ where: { ...scope, id: parsed.data.id }, include: { payments: { select: { status: true } } } });
      if (!existing) throw new BookingError("Booking not found", 404);
      if (terminal.includes(existing.status)) throw new BookingError("A closed booking cannot be modified", 409);
      let update: Prisma.BookingUpdateInput;
      let status = existing.status;
      if (role === "ADMIN" && request.method === "PATCH" && "status" in parsed.data) {
        if (existing.status !== "PENDING_PAYMENT" || existing.driverId) throw new BookingError("Only an unassigned pending booking can be confirmed", 409);
        if (existing.pickupAt.getTime() <= Date.now()) throw new BookingError("Pickup must be in the future");
        status = "CONFIRMED";
        update = {};
      } else if (role === "ADMIN" && request.method === "PATCH") {
        const { id: ignoredId, pickupAt, ...changes } = adminEdit.parse(body);
        void ignoredId;
        const driverId = changes.driverId === undefined ? existing.driverId : changes.driverId;
        if (changes.priceCents !== undefined && changes.priceCents !== existing.priceCents && existing.payments.some((payment) => ["PAID", "PROCESSING"].includes(payment.status))) throw new BookingError("A paid or processing fare cannot be changed", 409);
        const fareChanged = (["fromAddress", "toAddress", "tripType", "priceCents"] as const).some((key) => changes[key] !== undefined && changes[key] !== existing[key]);
        if (fareChanged && isAirportTrip({ tripType: changes.tripType ?? existing.tripType, fromAddress: changes.fromAddress ?? existing.fromAddress, toAddress: changes.toAddress ?? existing.toAddress })) {
          if ((changes.priceCents ?? existing.priceCents) > 3000) throw new BookingError("Airport transfers cannot exceed USD 30");
        }
        const vehicleId = changes.vehicleId === undefined ? existing.vehicleId : changes.vehicleId;
        const reassigning = driverId !== existing.driverId || vehicleId !== existing.vehicleId;
        if (["TRIP_STARTED", "DRIVER_ARRIVED", "DRIVER_EN_ROUTE"].includes(existing.status) && reassigning) throw new BookingError("An ongoing trip cannot be reassigned", 409);
        if (reassigning || changes.passengers !== undefined && changes.passengers !== existing.passengers) await assignment(tx, driverId, vehicleId, changes.passengers ?? existing.passengers);
        if (pickupAt && new Date(pickupAt).getTime() !== existing.pickupAt.getTime() && new Date(pickupAt).getTime() <= Date.now()) throw new BookingError("Pickup must be in the future");
        if (driverId !== existing.driverId) status = driverId ? "DRIVER_ASSIGNED" : "DRIVER_ASSIGNMENT_PENDING";
        const { driverId: ignoredDriver, vehicleId: ignoredVehicle, ...fields } = changes;
        void ignoredDriver; void ignoredVehicle;
        update = { ...fields, ...(pickupAt ? { pickupAt: new Date(pickupAt) } : {}), ...(driverId !== existing.driverId ? { driver: driverId ? { connect: { id: driverId } } : { disconnect: true } } : {}), ...(vehicleId !== existing.vehicleId ? { vehicle: vehicleId ? { connect: { id: vehicleId } } : { disconnect: true } } : {}) };
        if (existing.fareDetails && fareChanged) {
          if (existing.metered) throw new BookingError("Metered fare cannot be manually edited during a trip", 409);
          update.fareDetails = Prisma.DbNull;
        }
      } else {
        const next = command.parse(body).status;
        if (role === "DRIVER" && (request.method !== "PATCH" || driverTransitions[existing.status] !== next)) throw new BookingError("Invalid driver transition", 403);
        if (role !== "DRIVER" && (request.method !== "DELETE" || next !== "CANCELLED")) throw new BookingError("Cancellation required", 400);
        if (role === "CUSTOMER" && !["PENDING_PAYMENT", "CONFIRMED", "DRIVER_ASSIGNMENT_PENDING", "DRIVER_ASSIGNED"].includes(existing.status)) throw new BookingError("This trip can no longer be cancelled by the customer", 409);
        status = next;
        update = {};
        const fareValue = existing.fareDetails === null ? null : fareDetailsSchema.parse(existing.fareDetails);
        if (fareValue && next === "TRIP_STARTED") update.fareDetails = { ...fareValue, startedAt: new Date().toISOString() };
        if (fareValue && next === "TRIP_COMPLETED") {
          const finished = new Date();
          const snapshot: FareDetails = { ...fareValue, finalized: true };
          if (existing.metered) {
            if (!snapshot.startedAt) throw new BookingError("Meter start time missing", 409);
            const positions = await tx.driverLocation.findMany({ where: { driverId: existing.driverId!, bookingId: existing.id, recordedAt: { gte: new Date(snapshot.startedAt), lte: finished } }, orderBy: { recordedAt: "asc" } });
            const measured = measuredDistance(positions.map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude), accuracy: p.accuracy === null ? null : Number(p.accuracy), recordedAt: p.recordedAt })), new Date(snapshot.startedAt), finished);
            if (!measured.complete && confirmedRoute === null) throw new BookingError("GPS_INCOMPLETE_CONFIRM_ROUTE", 409);
            snapshot.distanceMeters = measured.complete ? measured.meters : confirmedRoute;
            snapshot.distanceSource = measured.complete ? "GPS" : "CONFIRMED_ROUTE";
          }
          if (snapshot.mode === "TOUR") {
            snapshot.extraHours = extraTourHours(snapshot.bookedHours, snapshot.startedAt ? finished.getTime() - new Date(snapshot.startedAt).getTime() : 0, snapshot.policy.tourIncludedHours);
            if (ending.success && ending.data.tourCircuit) {
              if (snapshot.circuit === "REMOTE" && ending.data.tourCircuit !== "REMOTE" || snapshot.circuit === "GRAND" && ending.data.tourCircuit === "SMALL") throw new BookingError("A reserved circuit cannot be downgraded", 409);
              snapshot.circuit = ending.data.tourCircuit;
            }
          }
          const finalPrice = priceFare(snapshot);
          if (finalPrice !== existing.priceCents && existing.payments.some((p) => ["PAID", "PROCESSING"].includes(p.status))) throw new BookingError("Payment already started; administrator review required", 409);
          update = { ...update, priceCents: finalPrice, fareDetails: snapshot };
        }
      }
      const confirming = role === "ADMIN" && request.method === "PATCH" && "status" in parsed.data;
      const result = await tx.booking.update({ where: { id: existing.id, updatedAt: existing.updatedAt }, data: { ...update, status, statusHistory: { create: { status, note: confirming ? "ADMIN operational confirmation; payment tracked separately" : `${role} update` } } }, include: bookingInclude });
      await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: existing.id, action: confirming ? "CONFIRM" : request.method === "DELETE" ? "CANCEL" : "UPDATE" } });
      if (status === "TRIP_COMPLETED" && existing.driverId && await tx.hub.count({ where: { active: true } })) {
        await tx.driverProfile.update({ where: { id: existing.driverId }, data: { returningToHub: true } });
      }
      return result;
    });
    return Response.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError || error instanceof z.ZodError) return Response.json({ error: "Invalid request values" }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Concurrent trip update; retry" }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "Booking changed; reload and retry" }, { status: 409 });
    console.error("Booking request failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
    return Response.json({ error: "Booking service unavailable" }, { status: 503 });
  }
}
