import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { activeFarePolicy } from "@/lib/fare-store";
import { roadRoute } from "@/lib/fare-routing";
import { locationPointSchema, routeDetailsSchema } from "@/lib/route-details";
import { distanceBetween, fareDetailsSchema, fareSupplements, priceFare, routeZone, type FareDetails } from "@/lib/fare-policy";
import { parseCoordinateAddress } from "@/lib/booking-location";

export const autonomousSelection = z.object({
  fromAddress: z.string().trim().min(1).max(500).refine((value) => !/^GPS:/i.test(value) || parseCoordinateAddress(value) !== null, "Invalid GPS coordinates"),
  toAddress: z.string().trim().min(1).max(500).refine((value) => !/^GPS:/i.test(value) || parseCoordinateAddress(value) !== null, "Invalid GPS coordinates"),
  fromPoint: locationPointSchema.optional(), toPoint: locationPointSchema.optional(),
  vehicleId: z.string().min(1).max(200),
}).strict();
const payloadSchema = z.object({
  accountId: z.string(), requestId: z.uuid(), expiresAt: z.number(),
  selection: autonomousSelection, route: routeDetailsSchema, fareDetails: fareDetailsSchema,
  priceCents: z.number().int().nonnegative().nullable(),
  vehicleCategory: z.string(),
});
export type AutonomousQuote = z.infer<typeof payloadSchema>;
export class TripInputError extends Error {}

function signature(payload: string) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be configured");
  return createHmac("sha256", process.env.AUTH_SECRET).update(`autonomous-trip:${payload}`).digest("base64url");
}

export function readTripQuote(token: string, accountId: string): AutonomousQuote | null {
  const [body, received, extra] = token.split(".");
  if (!body || !received || extra) return null;
  const expected = Buffer.from(signature(body));
  const actual = Buffer.from(received);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  let value: unknown;
  try { value = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  const parsed = payloadSchema.safeParse(value);
  return parsed.success && parsed.data.accountId === accountId ? parsed.data : null;
}

export function airportEndpoint(address: string, point = parseCoordinateAddress(address)) {
  return /^(SAI Airport|Siem Reap Angkor International Airport)/i.test(address)
    || Boolean(point && distanceBetween(point, { latitude: 13.3692, longitude: 104.2231 }) <= 2000);
}

export async function previewTrip(selection: z.infer<typeof autonomousSelection>, accountId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: selection.vehicleId } });
  if (!vehicle?.active) throw new TripInputError("Select an active vehicle");
  const [{ policy, tariffId }, route] = await Promise.all([activeFarePolicy(), roadRoute(selection.fromAddress, selection.toAddress, selection.fromPoint, selection.toPoint, true)]);
  const zone = routeZone(policy, [[route.from.longitude, route.from.latitude], ...route.coordinates, [route.to.longitude, route.to.latitude]]);
  const mode = airportEndpoint(selection.fromAddress, route.from) || airportEndpoint(selection.toAddress, route.to) ? "AIRPORT" : zone ? "CITY" : "OUTSIDE";
  const snapshot: FareDetails = {
    mode, policy, tariffId, distanceMeters: route.distanceMeters, distanceSource: mode === "AIRPORT" ? "PACKAGE" : "ROUTE",
    circuit: null, bookedHours: policy.tourIncludedHours, extraHours: 0, startedAt: null, finalized: false,
    zoneId: zone?.id ?? null, zoneName: zone?.name ?? null,
    supplements: mode === "CITY" ? fareSupplements(policy, vehicle.iconCategory, new Date()) : [],
  };
  const priceCents = mode === "OUTSIDE" ? null : priceFare(snapshot);
  if (priceCents !== null && (!Number.isSafeInteger(priceCents) || priceCents > 10000000)) throw new TripInputError("Calculated fare exceeds the supported limit; check the tariff");
  snapshot.initialPriceCents = priceCents;
  const quote: AutonomousQuote = { accountId, requestId: randomUUID(), expiresAt: Date.now() + 10 * 60000, selection, route, fareDetails: snapshot, priceCents, vehicleCategory: vehicle.iconCategory };
  const body = Buffer.from(JSON.stringify(quote)).toString("base64url");
  return { ...quote, token: `${body}.${signature(body)}` };
}
