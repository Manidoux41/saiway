import type { BookingStatus } from "@prisma/client";
import { knownLocationPoint } from "./booking-location";
import { defaultFarePolicy, distanceBetween, fareDetailsSchema } from "./fare-policy";
import { routeDetailsSchema } from "./route-details";

export const dispatchBufferMs = 30 * 60_000;
export const dispatchFallbackMs = 180 * 60_000;
export const dispatchGpsMaxAgeMs = 2 * 60_000;
export const inServiceStatuses: BookingStatus[] = ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"];
export const dispatchClosedStatuses: BookingStatus[] = ["TRIP_COMPLETED", "CANCELLED", "NO_SHOW", "REFUNDED"];

type ScheduledTrip = {
  pickupAt: Date; tripType: string; routeDetails: unknown; fareDetails: unknown;
  dispatchEndsAt?: Date | null; status?: BookingStatus; startedAt?: Date | null;
};

export function plannedDispatchEnd(trip: ScheduledTrip) {
  const route = trip.routeDetails == null ? null : routeDetailsSchema.parse(trip.routeDetails);
  const fare = trip.fareDetails == null ? null : fareDetailsSchema.parse(trip.fareDetails);
  const duration = trip.tripType === "TOURIST_TOUR"
    ? (fare?.bookedHours ?? defaultFarePolicy.tourIncludedHours) * 3_600_000
    : route && route.durationSeconds > 0 ? route.durationSeconds * 1000 : dispatchFallbackMs;
  return new Date(trip.pickupAt.getTime() + duration + dispatchBufferMs);
}

export function dispatchWindow(trip: ScheduledTrip, now = new Date()) {
  const inService = trip.status !== undefined && inServiceStatuses.includes(trip.status);
  return {
    start: inService ? new Date(Math.min(trip.pickupAt.getTime(), (trip.startedAt ?? now).getTime())) : trip.pickupAt,
    end: new Date(Math.max((trip.dispatchEndsAt ?? plannedDispatchEnd(trip)).getTime(), inService ? now.getTime() + dispatchBufferMs : 0)),
  };
}

export function dispatchOverlaps(first: { start: Date; end: Date }, second: { start: Date; end: Date }) {
  return first.start < second.end && second.start < first.end;
}

export function dispatchPickup(trip: Pick<ScheduledTrip, "routeDetails"> & { fromAddress: string }) {
  if (trip.routeDetails != null) return routeDetailsSchema.parse(trip.routeDetails).from;
  return knownLocationPoint(trip.fromAddress);
}

export function dispatchDistance(pickup: ReturnType<typeof dispatchPickup>, location: { latitude: number; longitude: number; accuracy: number | null; recordedAt: Date } | null, now: Date) {
  if (!pickup || !location || location.accuracy === null || location.accuracy > 50 || location.recordedAt > now || now.getTime() - location.recordedAt.getTime() > dispatchGpsMaxAgeMs) return Infinity;
  return distanceBetween(pickup, location);
}
