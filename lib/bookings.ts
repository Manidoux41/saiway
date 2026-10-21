import { randomUUID } from "node:crypto";
import { BookingStatus, Prisma, TripDirection, TripType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import { trackingStatuses } from "@/lib/trip-location";
import type { SessionRole } from "@/lib/auth-session";

const text = z.string().trim().min(1).max(500);
const nullableId = z.string().min(1).nullable().optional();
const details = z.object({
  fromAddress: text, toAddress: text,
  direction: z.enum(TripDirection), tripType: z.enum(TripType),
  pickupAt: z.iso.datetime({ offset: true }).refine((value) => new Date(value).getTime() > Date.now(), "Pickup must be in the future"),
  passengers: z.number().int().min(1).max(50),
  luggageCount: z.number().int().min(0).max(50).optional(),
  flightNumber: z.string().trim().max(100).optional(),
  pickupNotes: z.string().trim().max(2000).optional(),
  specialNeeds: z.string().trim().max(2000).optional(),
});
const adminCreate = details.extend({ customerId: text, driverId: nullableId, vehicleId: nullableId, priceCents: z.number().int().nonnegative().max(100000000) });
const customerCreate = details.extend({ paymentMethod: z.enum(["ONLINE", "DRIVER"]).optional(), contactPhone: z.string().trim().max(30).regex(/^\+?[\d\s().-]*$/, "Invalid phone number").optional() });
const adminEdit = details.partial().extend({ id: text, pickupAt: z.iso.datetime({ offset: true }).optional(), driverId: nullableId, vehicleId: nullableId, priceCents: z.number().int().nonnegative().max(100000000).optional() });
const adminConfirm = z.object({ id: text, status: z.literal("CONFIRMED") }).strict();
const adminPatch = z.union([adminEdit.strict(), adminConfirm]);
const command = z.object({ id: text, status: z.enum(BookingStatus) }).strict();
const terminal: BookingStatus[] = ["CANCELLED", "TRIP_COMPLETED", "NO_SHOW", "REFUNDED"];
const driverTransitions: Partial<Record<BookingStatus, BookingStatus>> = {
  DRIVER_ASSIGNED: "DRIVER_ACCEPTED", DRIVER_ACCEPTED: "DRIVER_EN_ROUTE",
  DRIVER_EN_ROUTE: "DRIVER_ARRIVED", DRIVER_ARRIVED: "TRIP_STARTED", TRIP_STARTED: "TRIP_COMPLETED",
};
export const bookingInclude = {
  payments: { select: { status: true, provider: true, amountCents: true, currency: true, collectionMethod: true } },
  customer: { select: { id: true, name: true, email: true, phone: true } },
  driver: { select: { id: true, user: { select: { name: true } } } },
  vehicle: { select: { id: true, name: true, plate: true, seats: true } },
} satisfies Prisma.BookingInclude;

async function fare(db: Pick<Prisma.TransactionClient, "pricingRule">, direction: TripDirection, tripType: TripType) {
  const rule = await db.pricingRule.findFirst({
    where: { active: true, effectiveAt: { lte: new Date() }, AND: [{ OR: [{ direction: null }, { direction }] }, { OR: [{ tripType: null }, { tripType }] }] },
    orderBy: [{ effectiveAt: "desc" }, { id: "asc" }],
  });
  return { priceCents: rule?.amountCents ?? 3500, currency: rule?.currency ?? "USD" };
}

export async function bookingQuote(request: Request) {
  try {
    if (!await authorize(request, "CUSTOMER")) return Response.json({ error: "Customer access required" }, { status: 403 });
    const url = new URL(request.url);
    const selection = details.pick({ direction: true, tripType: true }).safeParse({ direction: url.searchParams.get("direction"), tripType: url.searchParams.get("tripType") });
    if (!selection.success) return Response.json({ error: "Invalid route" }, { status: 400 });
    return Response.json(await fare(prisma, selection.data.direction, selection.data.tripType), { headers: { "Cache-Control": "no-store" } });
  } catch {
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
      const bookings = await prisma.booking.findMany({ where: scope, include: bookingInclude, orderBy: { pickupAt: "asc" } });
      return Response.json({ bookings }, { headers: { "Cache-Control": "no-store" } });
    }
    const body: unknown = await request.json();
    if (request.method === "POST") {
      if (role === "DRIVER") return Response.json({ error: "Drivers cannot create bookings" }, { status: 403 });
      const parsed = role === "ADMIN" ? adminCreate.strict().safeParse(body) : customerCreate.strict().safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues.map((issue) => issue.message).join("; ") }, { status: 400 });
      const value = parsed.data;
      const admin = role === "ADMIN" ? adminCreate.parse(body) : null;
      const booking = await prisma.$transaction(async (tx) => {
        const customerId = admin?.customerId ?? account.id;
        const customer = await tx.user.findUnique({ where: { id: customerId } });
        if (customer?.role !== "CUSTOMER" || customer.status !== "ACTIVE") throw new BookingError("Select an active customer");
        await assignment(tx, admin?.driverId, admin?.vehicleId, value.passengers);
        const quote = admin ? { priceCents: admin.priceCents, currency: "USD" } : await fare(tx, value.direction, value.tripType);
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
        const vehicleId = changes.vehicleId === undefined ? existing.vehicleId : changes.vehicleId;
        const reassigning = driverId !== existing.driverId || vehicleId !== existing.vehicleId;
        if (["TRIP_STARTED", "DRIVER_ARRIVED", "DRIVER_EN_ROUTE"].includes(existing.status) && reassigning) throw new BookingError("An ongoing trip cannot be reassigned", 409);
        if (reassigning || changes.passengers !== undefined && changes.passengers !== existing.passengers) await assignment(tx, driverId, vehicleId, changes.passengers ?? existing.passengers);
        if (pickupAt && new Date(pickupAt).getTime() !== existing.pickupAt.getTime() && new Date(pickupAt).getTime() <= Date.now()) throw new BookingError("Pickup must be in the future");
        if (driverId !== existing.driverId) status = driverId ? "DRIVER_ASSIGNED" : "DRIVER_ASSIGNMENT_PENDING";
        const { driverId: ignoredDriver, vehicleId: ignoredVehicle, ...fields } = changes;
        void ignoredDriver; void ignoredVehicle;
        update = { ...fields, ...(pickupAt ? { pickupAt: new Date(pickupAt) } : {}), ...(driverId !== existing.driverId ? { driver: driverId ? { connect: { id: driverId } } : { disconnect: true } } : {}), ...(vehicleId !== existing.vehicleId ? { vehicle: vehicleId ? { connect: { id: vehicleId } } : { disconnect: true } } : {}) };
      } else {
        const next = command.parse(body).status;
        if (role === "DRIVER" && (request.method !== "PATCH" || driverTransitions[existing.status] !== next)) throw new BookingError("Invalid driver transition", 403);
        if (role !== "DRIVER" && (request.method !== "DELETE" || next !== "CANCELLED")) throw new BookingError("Cancellation required", 400);
        if (role === "CUSTOMER" && !["PENDING_PAYMENT", "CONFIRMED", "DRIVER_ASSIGNMENT_PENDING", "DRIVER_ASSIGNED"].includes(existing.status)) throw new BookingError("This trip can no longer be cancelled by the customer", 409);
        status = next;
        update = {};
      }
      const confirming = role === "ADMIN" && request.method === "PATCH" && "status" in parsed.data;
      const result = await tx.booking.update({ where: { id: existing.id, updatedAt: existing.updatedAt }, data: { ...update, status, statusHistory: { create: { status, note: confirming ? "ADMIN operational confirmation; payment tracked separately" : `${role} update` } } }, include: bookingInclude });
      await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: existing.id, action: confirming ? "CONFIRM" : request.method === "DELETE" ? "CANCEL" : "UPDATE" } });
      if (!trackingStatuses.includes(status)) await tx.driverLocation.deleteMany({ where: { bookingId: existing.id } });
      return result;
    });
    return Response.json({ booking });
  } catch (error) {
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "Booking changed; reload and retry" }, { status: 409 });
    console.error("Booking request failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
    return Response.json({ error: "Booking service unavailable" }, { status: 503 });
  }
}
