import { z } from "zod";
import { parseCoordinateAddress, type LocationPoint } from "@/lib/booking-location";
import { searchPlaces } from "@/lib/place-search";
import { routeDetailsSchema, type SavedRoute } from "@/lib/route-details";

export async function roadRoute(fromAddress: string, toAddress: string, fromPoint?: LocationPoint, toPoint?: LocationPoint, cambodiaOnly = false): Promise<SavedRoute> {
  const signal = AbortSignal.timeout(15000);
  async function locate(address: string): Promise<LocationPoint> {
    const point = parseCoordinateAddress(address);
    if (point) return point;
    if (/^(SAI Airport|Siem Reap Angkor International Airport)/i.test(address)) return { latitude: 13.3692, longitude: 104.2231 };
    const places = await searchPlaces(address, signal, cambodiaOnly);
    if (!places[0]) throw new Error("Address not found");
    return { latitude: places[0].latitude, longitude: places[0].longitude };
  }
  const [from, to] = await Promise.all([fromPoint ?? locate(fromAddress), toPoint ?? locate(toAddress)]);
  const root = process.env.NEXT_PUBLIC_ROUTING_URL || "https://router.project-osrm.org";
  const response = await fetch(`${root.replace(/\/$/, "")}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Road distance unavailable");
  const result = z.object({ code: z.literal("Ok"), routes: z.array(z.object({ distance: z.number().finite().nonnegative(), duration: z.number().finite().nonnegative(), geometry: z.object({ coordinates: routeDetailsSchema.shape.coordinates }) })).min(1) }).safeParse(await response.json());
  if (!result.success) throw new Error("Invalid road route response");
  const route = result.data.routes[0];
  return { from, to, distanceMeters: route.distance, durationSeconds: route.duration, coordinates: route.geometry.coordinates };
}

export async function routeDistance(fromAddress: string, toAddress: string) {
  return (await roadRoute(fromAddress, toAddress)).distanceMeters;
}
