import { randomUUID } from "node:crypto";
import { BookingStatus, Prisma, TripDirection, TripType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import type { SessionRole } from "@/lib/auth-session";
import { coordinateAddress, parseCoordinateAddress } from "@/lib/booking-location";
import { circuitSchema, extraTourHours, fareDetailsSchema, measuredDistance, priceFare, type FareDetails } from "@/lib/fare-policy";
import { roadRoute, routeDistance } from "@/lib/fare-routing";
import { activeFarePolicy } from "@/lib/fare-store";
import { autonomousSelection, airportEndpoint, previewTrip, readTripQuote, TripInputError } from "@/lib/autonomous-trips";
import { locationPointSchema, routeDetailsSchema } from "@/lib/route-details";
import { fareSupplements } from "@/lib/fare-policy";
import { enqueueBookingPush } from "@/lib/push-events";
import { schedulePushDelivery } from "@/lib/push-delivery";
import { assertDispatchSlot, automaticDriver, DispatchError, dispatchTransaction } from "@/lib/driver-dispatch";
import { inServiceStatuses, plannedDispatchEnd } from "@/lib/dispatch-policy";

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
const guestName = z.string().trim().min(1).max(200).optional();
const adminCreate = details.extend({ customerId: text, passengerName: guestName, driverId: nullableId, vehicleId: nullableId, priceCents: z.number().int().nonnegative().max(100000000) });
const customerCreate = details.extend({ passengerName: guestName, paymentMethod: z.enum(["ONLINE", "DRIVER"]).optional(), contactPhone: z.string().trim().max(30).regex(/^\+?[\d\s().-]*$/, "Invalid phone number").optional(), tourCircuit: circuitSchema.optional(), tourHours: z.number().min(1).max(48).optional() });
const adminEdit = details.partial().extend({ id: text, pickupAt: z.iso.datetime({ offset: true }).optional(), driverId: nullableId, vehicleId: nullableId, priceCents: z.number().int().nonnegative().max(100000000).optional() });
const adminConfirm = z.object({ id: text, status: z.literal("CONFIRMED") }).strict();
const priceCorrection = z.object({ id: text, finalPriceCents: z.number().int().nonnegative().max(10000000), priceReason: z.string().trim().min(3).max(2000) }).strict();
const archiveCommand = z.object({ id: text, action: z.enum(["ARCHIVE", "RESTORE"]) }).strict();
const adminPatch = z.union([adminEdit.strict(), adminConfirm, priceCorrection]);
const command = z.object({ id: text, status: z.enum(BookingStatus), confirmEstimatedDistance: z.boolean().optional(), tourCircuit: circuitSchema.optional(), observations: z.string().trim().max(2000).optional(), finalPoint: locationPointSchema.optional() }).strict();
const passengerFields = z.object({ customerEmail: z.email().optional(), passengerName: z.string().trim().max(200).optional(), contactPhone: z.string().trim().max(50).optional(), passengers: z.number().int().min(1).max(50) });
const walkupCreate = details.omit({ pickupAt: true }).extend({ customerEmail: z.email().optional(), passengerName: z.string().trim().max(200).optional(), contactPhone: z.string().trim().max(50).optional(), vehicleId: text }).strict();
const quotedStart = passengerFields.extend({ quoteToken: z.string().max(3000000), guestBookingId: z.string().min(1).max(200).optional(), agreedPriceCents: z.number().int().nonnegative().max(10000000).optional(), priceReason: z.string().trim().min(3).max(2000).optional() }).strict();
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
  statusHistory: { orderBy: { createdAt: "asc" }, select: { status: true, note: true, createdAt: true } },
} satisfies Prisma.BookingInclude;

function isAirportTrip(value: { fromAddress: string; toAddress: string; tripType: TripType }) {
  return value.tripType !== "TOURIST_TOUR" && (value.tripType === "AIRPORT_TRANSFER" || [value.fromAddress, value.toAddress].some((address) => {
    return airportEndpoint(address);
  }));
}

async function fare(value: { fromAddress: string; toAddress: string; tripType: TripType; tourCircuit?: z.infer<typeof circuitSchema>; tourHours?: number }) {
  const { policy, tariffId } = await activeFarePolicy();
  if (value.tripType === "TOURIST_TOUR" && value.tourCircuit === "REMOTE" && policy.remoteCircuitCents === null) throw new BookingError("Remote circuit price must be configured by an administrator", 422);
  const mode = value.tripType === "TOURIST_TOUR" ? "TOUR" : isAirportTrip(value) ? "AIRPORT" : "CITY";
  const bookedHours = value.tourHours ?? policy.tourIncludedHours;
  const route = mode === "CITY" ? await roadRoute(value.fromAddress, value.toAddress) : null;
  const snapshot: FareDetails = {
    mode, policy, tariffId, supplements: mode === "CITY" ? fareSupplements(policy, undefined, new Date()) : [], distanceMeters: route?.distanceMeters ?? null,
    distanceSource: mode === "CITY" ? "ROUTE" : "PACKAGE", circuit: mode === "TOUR" ? value.tourCircuit ?? "SMALL" : null,
    bookedHours, extraHours: mode === "TOUR" ? extraTourHours(bookedHours, 0, policy.tourIncludedHours) : 0, startedAt: null, finalized: false,
  };
  return { priceCents: priceFare(snapshot), currency: "USD", fareDetails: snapshot, ...(route ? { routeDetails: route } : {}) };
}

export async function bookingQuote(request: Request) {
  try {
    const account = await authorize(request, "CUSTOMER");
    if (!account) return Response.json({ error: "Customer access required" }, { status: 403 });
    const professional = await prisma.professionalProfile.findUnique({ where: { userId: account.id }, select: { status: true } });
    if (professional && professional.status !== "APPROVED") return Response.json({ error: "PRO_APPROVAL_REQUIRED" }, { status: 403 });
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
      const bookings = await prisma.booking.findMany({ where: { ...scope, ...(role === "ADMIN" ? { adminArchivedAt: new URL(request.url).searchParams.get("archived") === "true" ? { not: null } : null } : {}) }, include: bookingInclude, orderBy: { pickupAt: "asc" } });
      const driverAvailability = role === "DRIVER" ? await prisma.driverProfile.findUniqueOrThrow({ where: { userId: account.id }, select: { isAvailable: true, availableSince: true, selectedVehicleId: true } }) : undefined;
      return Response.json({ bookings, driverAvailability }, { headers: { "Cache-Control": "no-store" } });
    }
    const body: unknown = await request.json();
    const archive = archiveCommand.safeParse(body);
    if (role === "ADMIN" && request.method === "PATCH" && archive.success) {
      const booking = await dispatchTransaction(async (tx) => {
        const existing = await tx.booking.findUnique({ where: { id: archive.data.id } });
        if (!existing) throw new BookingError("Booking not found", 404);
        const restoring = archive.data.action === "RESTORE";
        if (restoring ? !existing.adminArchivedAt : Boolean(existing.adminArchivedAt)) throw new BookingError("Booking changed; reload and retry", 409);
        if (!restoring && inServiceStatuses.includes(existing.status)) throw new BookingError("Cancel the ongoing trip before archiving", 409);
        const cancelling = !restoring && !terminal.includes(existing.status);
        const result = await tx.booking.update({
          where: { id: existing.id, updatedAt: existing.updatedAt },
          data: {
            adminArchivedAt: restoring ? null : new Date(),
            ...(cancelling ? { status: "CANCELLED", statusHistory: { create: { status: "CANCELLED", note: "ADMIN update" } } } : {}),
          },
          include: bookingInclude,
        });
        await tx.auditLog.create({ data: {
          actorId: account.id, entity: "Booking", entityId: existing.id, action: archive.data.action,
          metadata: { previousStatus: existing.status, status: result.status, cancelled: cancelling },
        } });
        if (cancelling) await enqueueBookingPush(tx, result, existing);
        return result;
      });
      schedulePushDelivery();
      return Response.json({ booking });
    }
    if (request.method === "POST") {
      if (role === "DRIVER") {
        const preview = z.object({ action: z.literal("preview"), selection: autonomousSelection }).strict().safeParse(body);
        if (preview.success) return Response.json(await previewTrip(preview.data.selection, account.id), { headers: { "Cache-Control": "no-store" } });
        const start = quotedStart.safeParse(body);
        const legacy = start.success ? null : walkupCreate.parse(body);
        if (legacy && legacy.tripType !== "CITY_TRANSFER") throw new BookingError("Walk-up trips must be city trips");
        const quote = start.success ? readTripQuote(start.data.quoteToken, account.id) : await previewTrip({ fromAddress: legacy!.fromAddress, toAddress: legacy!.toAddress, vehicleId: legacy!.vehicleId }, account.id);
        if (!quote) throw new BookingError("Invalid trip quote; calculate a new route");
        const duplicate = await prisma.booking.findUnique({ where: { startRequestId: quote.requestId }, include: bookingInclude });
        const guestBookingId = start.success ? start.data.guestBookingId : undefined;
        if (duplicate) {
          if (duplicate.driver?.id !== (await prisma.driverProfile.findUnique({ where: { userId: account.id }, select: { id: true } }))?.id || guestBookingId && duplicate.id !== guestBookingId) throw new BookingError("Invalid trip quote", 403);
          return Response.json({ booking: duplicate });
        }
        if (quote.expiresAt < Date.now()) throw new BookingError("Trip quote expired; calculate a new route", 409);
        const passenger = start.success ? start.data : passengerFields.parse(legacy);
        const outside = quote.fareDetails.mode === "OUTSIDE";
        if (outside && (!start.success || start.data.agreedPriceCents === undefined || !start.data.priceReason)) throw new BookingError("Outside-zone trips require an agreed price and reason", 422);
        if (!outside && start.success && (start.data.agreedPriceCents !== undefined || start.data.priceReason)) throw new BookingError("Automatic fares cannot be overridden by the driver");
        const priceCents = outside && start.success ? start.data.agreedPriceCents! : quote.priceCents!;
        const created = await dispatchTransaction(async (tx) => {
          const driver = await tx.driverProfile.findUniqueOrThrow({ where: { userId: account.id } });
          const guest = guestBookingId ? await tx.booking.findFirst({ where: { id: guestBookingId, driverId: driver.id, originType: "GUEST", pricingStatus: "AWAITING_DESTINATION", status: "DRIVER_ARRIVED", adminArchivedAt: null } }) : null;
          if (guestBookingId && !guest) throw new BookingError("Guest pickup must be assigned to you and marked arrived before departure", 409);
          if (guest && (guest.vehicleId !== quote.selection.vehicleId || coordinateAddress(quote.route.from) !== guest.fromAddress || passenger.customerEmail || passenger.passengerName || passenger.contactPhone)) throw new BookingError("Keep the guest pickup and assigned vehicle; no account or contact details required", 409);
          if (!driver.isAvailable) throw new BookingError("Driver must be available", 409);
          await tx.driverProfile.update({ where: { id: driver.id }, data: { returningToHub: false } });
          if (await tx.booking.count({ where: { ...(guest ? { id: { not: guest.id } } : {}), driverId: driver.id, status: { in: ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"] } } })) throw new BookingError("Finish the current trip first", 409);
          if (await tx.booking.count({ where: { ...(guest ? { id: { not: guest.id } } : {}), vehicleId: quote.selection.vehicleId, status: { in: ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"] } } })) throw new BookingError("Vehicle already in use", 409);
          const customer = passenger.customerEmail ? await tx.user.findUnique({ where: { email: passenger.customerEmail.toLowerCase() }, include: { professional: true } }) : null;
          if (passenger.customerEmail && (!customer || customer.role !== "CUSTOMER" || customer.status !== "ACTIVE")) throw new BookingError("Select an existing active customer");
          if (customer?.professional && customer.professional.status !== "APPROVED") throw new BookingError("PRO_APPROVAL_REQUIRED", 403);
          if (customer?.professional && !passenger.passengerName?.trim()) throw new BookingError("PRO_PASSENGER_REQUIRED");
          const vehicle = await tx.vehicle.findUnique({ where: { id: quote.selection.vehicleId } });
          if (!vehicle?.active || vehicle.seats < passenger.passengers) throw new BookingError("Invalid vehicle capacity");
          if (vehicle.iconCategory !== quote.vehicleCategory) throw new BookingError("Vehicle category changed; calculate a new quote", 409);
          const latest = await tx.driverLocation.findFirst({ where: { driverId: driver.id }, orderBy: { recordedAt: "desc" } });
          const startedAt = new Date();
          const snapshot: FareDetails = { ...quote.fareDetails, initialPriceCents: priceCents, negotiatedPriceCents: outside ? priceCents : null, startedAt: startedAt.toISOString() };
          const tripData = { fromAddress: quote.selection.fromAddress, toAddress: quote.selection.toAddress, vehicleId: vehicle.id, passengers: passenger.passengers, passengerName: passenger.passengerName || null, contactPhone: passenger.contactPhone || null,
              professionalCompany: customer?.professional?.companyName ?? null, professionalPhone: customer?.professional?.contactPhone ?? null,
              direction: airportEndpoint(quote.selection.toAddress, quote.route.to) ? "CITY_TO_AIRPORT" : "AIRPORT_TO_CITY", tripType: snapshot.mode === "AIRPORT" ? "AIRPORT_TRANSFER" : "CITY_TRANSFER",
              priceCents, currency: "USD", fareDetails: snapshot, metered: snapshot.mode === "CITY", routeDetails: quote.route, estimatedPriceCents: priceCents, pricingStatus: outside ? "DRIVER_AGREED" : "AUTOMATIC",
              originType: guest ? "GUEST" : "DRIVER", startRequestId: quote.requestId, startedAt, dispatchEndsAt: plannedDispatchEnd({ pickupAt: startedAt, tripType: snapshot.mode === "AIRPORT" ? "AIRPORT_TRANSFER" : "CITY_TRANSFER", fareDetails: snapshot, routeDetails: quote.route }), customerId: customer?.id, driverId: driver.id, pickupAt: guest?.pickupAt ?? startedAt, paymentMethod: "DRIVER", status: "TRIP_STARTED",
              statusHistory: { create: { status: "TRIP_STARTED", note: outside && start.success ? `DRIVER_AGREED: ${start.data.priceReason}` : guest ? "Guest destination and fare confirmed with passenger before departure" : "Driver started autonomous trip; estimate retained" } } } satisfies Prisma.BookingUncheckedUpdateInput;
          const booking = guest
            ? await tx.booking.update({ where: { id: guest.id, updatedAt: guest.updatedAt }, data: tripData, include: bookingInclude })
            : await tx.booking.create({ data: { ...tripData, reference: `SW-${randomUUID().toUpperCase()}` }, include: bookingInclude });
          await assertDispatchSlot(tx, booking);
          if (latest && Date.now() - latest.recordedAt.getTime() <= 60000 && latest.accuracy !== null && Number(latest.accuracy) <= 50) await tx.driverLocation.create({ data: { driverId: driver.id, bookingId: booking.id, latitude: latest.latitude, longitude: latest.longitude, accuracy: latest.accuracy, recordedAt: startedAt } });
          await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: booking.id, action: guest ? "START_GUEST_TRIP" : "START_AUTONOMOUS_TRIP", metadata: { priceCents, pricingStatus: booking.pricingStatus, reason: start.success ? start.data.priceReason ?? null : null, tariffId: snapshot.tariffId ?? null } } });
          await enqueueBookingPush(tx, booking, guest ?? undefined);
          return booking;
        }).catch(async (error: unknown) => {
          if (error instanceof Prisma.PrismaClientKnownRequestError && ["P2034", "P2002"].includes(error.code)) {
            const duplicate = await prisma.booking.findFirst({ where: { startRequestId: quote.requestId, driver: { userId: account.id } }, include: bookingInclude });
            if (duplicate && (!guestBookingId || duplicate.id === guestBookingId)) return duplicate;
          }
          throw error;
        });
        schedulePushDelivery();
        return Response.json({ booking: created }, { status: 201 });
      }
      const parsed = role === "ADMIN" ? adminCreate.strict().safeParse(body) : customerCreate.strict().safeParse(body);
      if (!parsed.success) return Response.json({ error: parsed.error.issues.map((issue) => issue.message).join("; ") }, { status: 400 });
      const value = parsed.data;
      const admin = role === "ADMIN" ? adminCreate.parse(body) : null;
      if (!admin) {
        const professional = await prisma.professionalProfile.findUnique({ where: { userId: account.id }, select: { status: true } });
        if (professional && professional.status !== "APPROVED") throw new BookingError("PRO_APPROVAL_REQUIRED", 403);
        if (professional && !customerCreate.parse(value).passengerName) throw new BookingError("PRO_PASSENGER_REQUIRED");
      }
      const quote = admin ? { priceCents: admin.priceCents, currency: "USD" } : await fare(customerCreate.parse(value));
      if (admin && isAirportTrip(admin) && admin.priceCents > 3000) throw new BookingError("Airport transfers cannot exceed USD 30");
      if (!admin && quote.currency === "USD" && value.tripType === "TOURIST_TOUR" && customerCreate.parse(value).paymentMethod === "ONLINE") throw new BookingError("Tour supplements are settled with the driver; select pay at driver");
      const booking = await dispatchTransaction(async (tx) => {
        const customerId = admin?.customerId ?? account.id;
        const customer = await tx.user.findUnique({ where: { id: customerId }, include: { professional: true } });
        if (customer?.role !== "CUSTOMER" || customer.status !== "ACTIVE") throw new BookingError("Select an active customer");
        const professional = customer.professional;
        if (professional && professional.status !== "APPROVED") throw new BookingError("PRO_APPROVAL_REQUIRED", 403);
        const passengerName = admin ? admin.passengerName : customerCreate.parse(value).passengerName;
        if (professional && !passengerName) throw new BookingError("PRO_PASSENGER_REQUIRED");
        await assignment(tx, admin?.driverId, admin?.vehicleId, value.passengers);
        const status: BookingStatus = admin?.driverId ? "DRIVER_ASSIGNED" : "PENDING_PAYMENT";
        let created = await tx.booking.create({
          data: { ...details.parse(value), ...(admin ? {} : (({ paymentMethod, contactPhone }) => ({ paymentMethod, contactPhone: contactPhone || null }))(customerCreate.parse(value))), passengerName: passengerName ?? null,
            professionalCompany: professional?.companyName ?? null, professionalPhone: professional?.contactPhone ?? null,
            customerId, originType: professional ? "PROFESSIONAL" : admin ? "ADMIN" : "CUSTOMER", estimatedPriceCents: quote.priceCents, reference: `SW-${randomUUID().toUpperCase()}`, pickupAt: new Date(value.pickupAt), ...quote, driverId: admin?.driverId, vehicleId: admin?.vehicleId, status, statusHistory: { create: { status, note: "Booking created; payment is tracked separately" } } },
          include: bookingInclude,
        });
        created = await tx.booking.update({ where: { id: created.id }, data: { dispatchEndsAt: plannedDispatchEnd(created) }, include: bookingInclude });
        const selected = !admin ? await automaticDriver(tx, created) : null;
        if (selected) {
          created = await tx.booking.update({
            where: { id: created.id },
            data: { driverId: selected.driverId, vehicleId: selected.vehicleId, status: "DRIVER_ASSIGNED", statusHistory: { create: { status: "DRIVER_ASSIGNED", note: "Automatic assignment; payment tracked separately" } } },
            include: bookingInclude,
          });
          await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: created.id, action: "AUTO_ASSIGN", metadata: { driverId: selected.driverId, vehicleId: selected.vehicleId, distanceMeters: selected.distanceMeters, fallback: selected.distanceMeters === null } } });
        }
        await assertDispatchSlot(tx, created);
        await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: created.id, action: "CREATE" } });
        await enqueueBookingPush(tx, created);
        return created;
      });
      schedulePushDelivery();
      return Response.json({ booking }, { status: 201 });
    }
    let confirmedRoute: number | null = null;
    const ending = command.safeParse(body);
    if (role === "DRIVER" && ending.success && ending.data.status === "TRIP_COMPLETED" && ending.data.confirmEstimatedDistance) {
      const own = await prisma.booking.findFirst({ where: { ...scope, id: ending.data.id, status: "TRIP_STARTED", metered: true } });
      if (!own) throw new BookingError("Active metered trip not found", 404);
      confirmedRoute = own.routeDetails ? routeDetailsSchema.parse(own.routeDetails).distanceMeters : await routeDistance(own.fromAddress, own.toAddress);
    }
    const booking = await dispatchTransaction(async (tx) => {
      const parsed = request.method === "PATCH" && role === "ADMIN" ? adminPatch.safeParse(body) : command.safeParse(body);
      if (!parsed.success) throw new BookingError("Invalid booking update");
      const existing = await tx.booking.findFirst({ where: { ...scope, id: parsed.data.id }, include: { payments: { select: { status: true } } } });
      if (!existing) throw new BookingError("Booking not found", 404);
      if (existing.originType === "GUEST" && existing.pricingStatus === "AWAITING_DESTINATION" && (
        "status" in parsed.data && ["TRIP_STARTED", "TRIP_COMPLETED"].includes(parsed.data.status)
        || "finalPriceCents" in parsed.data
        || "fromAddress" in parsed.data && parsed.data.fromAddress !== existing.fromAddress
        || "toAddress" in parsed.data && parsed.data.toAddress !== existing.toAddress
        || "priceCents" in parsed.data && parsed.data.priceCents !== existing.priceCents
        || "tripType" in parsed.data && parsed.data.tripType !== existing.tripType
      )) throw new BookingError("Confirm the guest destination and fare with the assigned driver before departure", 409);
      if (role === "ADMIN" && existing.adminArchivedAt) throw new BookingError("Restore the archived booking before editing", 409);
      if (role === "ADMIN" && "finalPriceCents" in parsed.data) {
        const correction = priceCorrection.parse(body);
        if (existing.payments.some((payment) => ["PAID", "PROCESSING"].includes(payment.status))) throw new BookingError("A paid or processing fare cannot be changed", 409);
        if (isAirportTrip(existing) && correction.finalPriceCents > 3000) throw new BookingError("Airport transfers cannot exceed USD 30");
        const snapshot = existing.fareDetails === null ? null : fareDetailsSchema.parse(existing.fareDetails);
        if (snapshot) snapshot.adjustmentCents = (snapshot.adjustmentCents ?? 0) + correction.finalPriceCents - existing.priceCents;
        const updated = await tx.booking.update({ where: { id: existing.id, updatedAt: existing.updatedAt }, data: { priceCents: correction.finalPriceCents, pricingStatus: "ADMIN_ADJUSTED", ...(snapshot ? { fareDetails: snapshot } : {}), statusHistory: { create: { status: existing.status, note: `PRICE_ADJUSTMENT ${existing.priceCents} -> ${correction.finalPriceCents} USD cents: ${correction.priceReason}` } } }, include: bookingInclude });
        await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: existing.id, action: "PRICE_ADJUSTMENT", metadata: { oldCents: existing.priceCents, newCents: correction.finalPriceCents, reason: correction.priceReason } } });
        return updated;
      }
      if (terminal.includes(existing.status)) throw new BookingError("A closed booking cannot be modified", 409);
      let update: Prisma.BookingUpdateInput;
      let retainedEstimate = false;
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
        if (["DRIVER", "GUEST"].includes(existing.originType) && fareChanged) throw new BookingError("Use a justified price correction; the recorded autonomous route is immutable", 409);
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
        if (changes.fromAddress !== undefined && changes.fromAddress !== existing.fromAddress || changes.toAddress !== undefined && changes.toAddress !== existing.toAddress) update.routeDetails = Prisma.DbNull;
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
        if (next === "TRIP_STARTED") {
          const startTime = new Date();
          update.startedAt = startTime;
          if (fareValue) update.fareDetails = { ...fareValue, startedAt: startTime.toISOString() };
        }
        if (["DRIVER_EN_ROUTE", "TRIP_STARTED"].includes(next) && existing.driverId) {
          if (await tx.booking.count({ where: { id: { not: existing.id }, status: { in: inServiceStatuses }, OR: [{ driverId: existing.driverId }, ...(existing.vehicleId ? [{ vehicleId: existing.vehicleId }] : [])] } })) throw new DispatchError("Finish the current trip first");
        }
        if (fareValue && next === "TRIP_COMPLETED") {
          const finished = new Date();
          const snapshot: FareDetails = { ...fareValue, finalized: true };
          if (existing.metered) {
            if (!snapshot.startedAt) throw new BookingError("Meter start time missing", 409);
            const positions = await tx.driverLocation.findMany({ where: { driverId: existing.driverId!, bookingId: existing.id, recordedAt: { gte: new Date(snapshot.startedAt), lte: finished } }, orderBy: { recordedAt: "asc" } });
            const measured = measuredDistance(positions.map((p) => ({ latitude: Number(p.latitude), longitude: Number(p.longitude), accuracy: p.accuracy === null ? null : Number(p.accuracy), recordedAt: p.recordedAt })), new Date(snapshot.startedAt), finished);
            if (!measured.complete && confirmedRoute === null) throw new BookingError("GPS_INCOMPLETE_CONFIRM_ROUTE", 409);
            retainedEstimate = measured.complete && measured.meters === 0 && existing.priceCents > 0;
            if (retainedEstimate) {
              snapshot.zeroGpsEstimateRetained = true;
            } else {
              snapshot.distanceMeters = measured.complete ? measured.meters : confirmedRoute;
              snapshot.distanceSource = measured.complete ? "GPS" : "CONFIRMED_ROUTE";
            }
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
        if (next === "TRIP_COMPLETED") {
          const finished = new Date();
          const input = command.parse(body);
          const startTime = existing.startedAt ?? (fareValue?.startedAt ? new Date(fareValue.startedAt) : null);
          update = { ...update, completedAt: finished, actualDurationSeconds: startTime ? Math.max(0, Math.round((finished.getTime() - startTime.getTime()) / 1000)) : null, driverObservations: input.observations || null, ...(input.finalPoint ? { finalLatitude: input.finalPoint.latitude, finalLongitude: input.finalPoint.longitude } : {}) };
        }
      }
      const confirming = role === "ADMIN" && request.method === "PATCH" && "status" in parsed.data;
      let result = await tx.booking.update({ where: { id: existing.id, updatedAt: existing.updatedAt }, data: { ...update, status, statusHistory: { create: { status, note: confirming ? "ADMIN operational confirmation; payment tracked separately" : status === "TRIP_COMPLETED" ? `FARE_FINALIZED ${existing.priceCents} -> ${String(update.priceCents ?? existing.priceCents)} USD cents; ${retainedEstimate ? "zero GPS distance; original road estimate retained" : confirmedRoute !== null ? "driver confirmed road estimate" : existing.metered ? "GPS distance" : "agreed/package fare"}; ${ending.success ? ending.data.observations ?? "" : ""}` : `${role} update` } } }, include: bookingInclude });
      if (role === "ADMIN" && request.method === "PATCH" && !confirming) {
        result = await tx.booking.update({ where: { id: result.id }, data: { dispatchEndsAt: plannedDispatchEnd(result) }, include: bookingInclude });
        await assertDispatchSlot(tx, result);
      }
      await tx.auditLog.create({ data: { actorId: account.id, entity: "Booking", entityId: existing.id, action: confirming ? "CONFIRM" : request.method === "DELETE" ? "CANCEL" : "UPDATE", metadata: { oldCents: existing.priceCents, newCents: result.priceCents, status, confirmedEstimatedDistance: confirmedRoute !== null, zeroGpsEstimateRetained: retainedEstimate } } });
      if (status === "TRIP_COMPLETED" && existing.driverId && await tx.hub.count({ where: { active: true } })) {
        await tx.driverProfile.update({ where: { id: existing.driverId }, data: { returningToHub: true, availableSince: new Date() } });
      } else if (status === "TRIP_COMPLETED" && existing.driverId) {
        await tx.driverProfile.update({ where: { id: existing.driverId }, data: { availableSince: new Date() } });
      }
      await enqueueBookingPush(tx, result, existing);
      return result;
    });
    schedulePushDelivery();
    return Response.json({ booking });
  } catch (error) {
    if (error instanceof DispatchError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof BookingError) return Response.json({ error: error.message }, { status: error.status });
    if (error instanceof TripInputError) return Response.json({ error: error.message }, { status: 422 });
    if (error instanceof SyntaxError || error instanceof z.ZodError) return Response.json({ error: "Invalid request values" }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Concurrent trip update; retry" }, { status: 409 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "Booking changed; reload and retry" }, { status: 409 });
    console.error("Booking request failed", {
      code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN",
      kind: error instanceof Error ? error.name : "UNKNOWN",
    });
    return Response.json({ error: "Booking service unavailable" }, { status: 503 });
  }
}
