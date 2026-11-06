import { z } from "zod";

const cents = z.number().int().nonnegative().max(10000000);
export const zoneSchema = z.object({
  id: z.string().min(1).max(100), name: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  radiusKm: z.number().positive().max(500), active: z.boolean(),
}).strict();
export const defaultZones = [{ id: "siem-reap", name: "Siem Reap", latitude: 13.36, longitude: 103.85, radiusKm: 20, active: true }];
export const farePolicyKey = "transportFarePolicy";
export const farePolicySchema = z.object({
  airportCents: cents.max(3000),
  cityCentsPerKm: cents.positive(),
  smallCircuitCents: cents.positive(),
  grandCircuitCents: cents.positive(),
  remoteCircuitCents: cents.positive().nullable(),
  tourIncludedHours: z.number().int().min(1).max(24),
  tourIncludedKm: z.number().positive().max(1000),
  tourExtraHourCents: cents,
  cityPickupCents: cents.default(0),
  cityMinimumCents: cents.default(0),
  vehicleSurcharges: z.partialRecord(z.enum(["TUK_TUK", "PASSAPP", "SEDAN", "SUV", "MINIVAN", "MINIBUS", "VAN", "OTHER"]), cents).default({}),
  timeSurcharges: z.array(z.object({ label: z.string().trim().min(1).max(100), startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(0).max(23), cents }).strict().refine((value) => value.startHour !== value.endHour, "Time range must not be empty")).max(24).default([]),
  exceptionalSurcharges: z.array(z.object({ label: z.string().trim().min(1).max(100), cents }).strict()).max(20).default([]),
  zones: z.array(zoneSchema).max(30).default(defaultZones).refine((zones) => new Set(zones.map((zone) => zone.id)).size === zones.length, "Duplicate zone ids"),
  khrPerUsd: z.number().positive().max(1000000).nullable().default(null),
}).strict().refine((value) => value.grandCircuitCents >= value.smallCircuitCents
  && (value.remoteCircuitCents === null || value.remoteCircuitCents >= value.grandCircuitCents),
  "Higher circuits must not cost less than the preceding package");
export type FarePolicy = z.infer<typeof farePolicySchema>;
export const defaultFarePolicy: FarePolicy = {
  airportCents: 3000, cityCentsPerKm: 65,
  smallCircuitCents: 3500, grandCircuitCents: 4500, remoteCircuitCents: null,
  tourIncludedHours: 8, tourIncludedKm: 35, tourExtraHourCents: 500,
  cityPickupCents: 0, cityMinimumCents: 0, vehicleSurcharges: {}, timeSurcharges: [], exceptionalSurcharges: [], zones: defaultZones, khrPerUsd: null,
};
export const circuitSchema = z.enum(["SMALL", "GRAND", "REMOTE"]);
export const fareDetailsSchema = z.object({
  mode: z.enum(["AIRPORT", "CITY", "TOUR", "OUTSIDE"]),
  policy: farePolicySchema,
  distanceMeters: z.number().finite().nonnegative().nullable(),
  distanceSource: z.enum(["ROUTE", "GPS", "CONFIRMED_ROUTE", "PACKAGE"]),
  circuit: circuitSchema.nullable(),
  bookedHours: z.number().min(1).max(48),
  extraHours: z.number().int().nonnegative(),
  startedAt: z.iso.datetime().nullable(),
  finalized: z.boolean(),
  zeroGpsEstimateRetained: z.boolean().optional(),
  initialPriceCents: cents.nullable().optional(),
  negotiatedPriceCents: cents.nullable().optional(),
  adjustmentCents: z.number().int().optional(),
  supplements: z.array(z.object({ label: z.string(), cents })).optional(),
  zoneId: z.string().nullable().optional(),
  zoneName: z.string().nullable().optional(),
  tariffId: z.string().nullable().optional(),
});
export type FareDetails = z.infer<typeof fareDetailsSchema>;

export function farePolicy(value?: string | null): FarePolicy {
  return value == null ? defaultFarePolicy : farePolicySchema.parse(JSON.parse(value));
}

export function priceFare(details: FareDetails): number {
  if (details.mode === "AIRPORT") return Math.max(0, Math.min(3000, details.policy.airportCents + (details.adjustmentCents ?? 0)));
  if (details.mode === "OUTSIDE") {
    if (details.negotiatedPriceCents == null) throw new Error("Agreed outside-zone fare required");
    return Math.max(0, details.negotiatedPriceCents + (details.adjustmentCents ?? 0));
  }
  if (details.mode === "CITY") {
    if (details.distanceMeters === null) throw new Error("Distance required for city fare");
    return Math.max(0, Math.max(details.policy.cityMinimumCents, details.policy.cityPickupCents + Math.round(details.distanceMeters * details.policy.cityCentsPerKm / 1000)
      + (details.supplements ?? []).reduce((total, item) => total + item.cents, 0)) + (details.adjustmentCents ?? 0));
  }
  const base = details.circuit === "GRAND" ? details.policy.grandCircuitCents
    : details.circuit === "REMOTE" ? details.policy.remoteCircuitCents : details.policy.smallCircuitCents;
  if (base === null) throw new Error("Remote circuit price must be configured by an administrator");
  return Math.max(0, base + details.extraHours * details.policy.tourExtraHourCents + (details.adjustmentCents ?? 0));
}

export function routeZone(policy: FarePolicy, coordinates: [number, number][]) {
  return policy.zones.find((zone) => zone.active && coordinates.length > 0 && coordinates.every(([longitude, latitude]) => distanceBetween(zone, { latitude, longitude }) <= zone.radiusKm * 1000)) ?? null;
}

export function fareSupplements(policy: FarePolicy, category: string | undefined, at: Date) {
  const supplements = [...policy.exceptionalSurcharges];
  const vehicle = Object.entries(policy.vehicleSurcharges).find(([key]) => key === category)?.[1];
  if (vehicle && category) supplements.push({ label: category, cents: vehicle });
  const hour = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Phnom_Penh" }).format(at));
  for (const item of policy.timeSurcharges) {
    if (item.startHour < item.endHour ? hour >= item.startHour && hour < item.endHour : hour >= item.startHour || hour < item.endHour) supplements.push({ label: item.label, cents: item.cents });
  }
  return supplements;
}

export function extraTourHours(bookedHours: number, elapsedMs: number, includedHours: number): number {
  return Math.ceil(Math.max(0, Math.max(bookedHours, elapsedMs / 3600000) - includedHours));
}

export function distanceBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = (n: number) => n * Math.PI / 180;
  const h = Math.sin(radians(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(radians(b.longitude - a.longitude) / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function measuredDistance(points: { latitude: number; longitude: number; accuracy: number | null; recordedAt: Date }[], startedAt: Date, endedAt: Date) {
  let meters = 0;
  let anchor = points[0];
  let complete = points.length >= 2;
  if (points.length) {
    complete &&= points[0].recordedAt.getTime() - startedAt.getTime() <= 60000
      && endedAt.getTime() - points[points.length - 1].recordedAt.getTime() <= 60000;
  }
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    if (point.accuracy === null || point.accuracy > 50) complete = false;
    if (!i) continue;
    const previous = points[i - 1];
    const seconds = (point.recordedAt.getTime() - previous.recordedAt.getTime()) / 1000;
    const segment = distanceBetween(previous, point);
    if (seconds <= 0 || seconds > 60 || segment / seconds > 160 / 3.6) { complete = false; continue; }
    const displacement = distanceBetween(anchor, point);
    if (displacement >= Math.max(5, (anchor.accuracy ?? 50) + (point.accuracy ?? 50))) {
      meters += displacement;
      anchor = point;
    }
  }
  return { meters, complete };
}
