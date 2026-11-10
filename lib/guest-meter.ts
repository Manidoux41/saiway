import { airportEndpoint } from "@/lib/autonomous-trips";
import { coordinateAddress } from "@/lib/booking-location";
import { measuredDistance, priceFare, routeZone, type FareDetails } from "@/lib/fare-policy";

type Position = { latitude: number; longitude: number; accuracy: number | null; recordedAt: Date };

export function guestMeterFare(fare: FareDetails, positions: Position[], finished: Date, confirmedDistance: number | null = null) {
  if (!fare.startedAt || !fare.meterStartPoint) throw new Error("Guest meter start missing");
  const started = new Date(fare.startedAt);
  const points = [{ ...fare.meterStartPoint, recordedAt: started }, ...positions.filter((point) => point.recordedAt > started && point.recordedAt <= finished)];
  const measured = measuredDistance(points, started, finished);
  const last = points[points.length - 1];
  const dropoff = positions.length > 0 && finished.getTime() - last.recordedAt.getTime() <= 60_000 && last.accuracy !== null && last.accuracy <= 50 ? last : null;
  const airport = airportEndpoint(coordinateAddress(fare.meterStartPoint)) || Boolean(dropoff && airportEndpoint(coordinateAddress(dropoff)));
  const zone = routeZone(fare.policy, points.map((point) => [point.longitude, point.latitude]));
  const snapshot: FareDetails = {
    ...fare, mode: airport ? "AIRPORT" : "CITY",
    distanceMeters: measured.complete ? measured.meters : confirmedDistance ?? measured.meters,
    distanceSource: measured.complete || confirmedDistance === null ? "GPS" : "CONFIRMED_ROUTE",
    zoneId: zone?.id ?? null, zoneName: zone?.name ?? null,
  };
  const priceCents = priceFare(snapshot);
  if (!Number.isSafeInteger(priceCents) || priceCents > 10000000) throw new Error("Guest meter fare exceeds supported limit");
  return { snapshot, priceCents, complete: measured.complete, dropoff };
}
