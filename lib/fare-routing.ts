import { z } from "zod";
import { parseCoordinateAddress, type LocationPoint } from "@/lib/booking-location";
import { searchPlaces } from "@/lib/place-search";

export async function routeDistance(fromAddress: string, toAddress: string): Promise<number> {
  const signal = AbortSignal.timeout(15000);
  async function locate(address: string): Promise<LocationPoint> {
    const point = parseCoordinateAddress(address);
    if (point) return point;
    if (/^(SAI Airport|Siem Reap Angkor International Airport)/i.test(address)) return { latitude: 13.3692, longitude: 104.2231 };
    const places = await searchPlaces(address, signal);
    if (!places[0]) throw new Error("Address not found");
    return places[0];
  }
  const [from, to] = await Promise.all([locate(fromAddress), locate(toAddress)]);
  const root = process.env.NEXT_PUBLIC_ROUTING_URL || "https://router.project-osrm.org";
  const response = await fetch(`${root.replace(/\/$/, "")}/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=false`, { signal, cache: "no-store" });
  if (!response.ok) throw new Error("Road distance unavailable");
  const result = z.object({ code: z.literal("Ok"), routes: z.array(z.object({ distance: z.number().finite().nonnegative() })).min(1) }).parse(await response.json());
  return result.routes[0].distance;
}
