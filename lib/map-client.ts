"use client";

import L from "leaflet";
import type { VehicleIconCategory } from "@prisma/client";
import { parseCoordinateAddress } from "@/lib/booking-location";
import { searchPlaces } from "@/lib/place-search";

export type MapPoint = { latitude: number; longitude: number };
export type RouteResult = { points: [number, number][]; distance: number; duration: number };

export const mapTileUrl = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const mapTileAttribution = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';
const routingUrl = process.env.NEXT_PUBLIC_ROUTING_URL || "https://router.project-osrm.org";

const iconGlyph: Record<VehicleIconCategory, string> = {
  TUK_TUK: "🛺",
  PASSAPP: "🛺",
  SEDAN: "🚘",
  SUV: "🚙",
  MINIVAN: "🚐",
  MINIBUS: "🚌",
  VAN: "🚐",
  OTHER: "🚗",
};

export function vehicleMarkerIcon(category: VehicleIconCategory, heading: number | null, customIconUrl?: string | null) {
  const content = customIconUrl
    ? `<img src="${customIconUrl}" alt="" class="saiway-vehicle-image">`
    : `<span aria-hidden="true">${iconGlyph[category]}</span>`;
  const angle = heading === null || !Number.isFinite(heading) ? 0 : heading;
  return L.divIcon({
    className: "",
    html: `<span class="saiway-vehicle-marker" style="--vehicle-heading:${angle}deg">${content}</span>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  });
}

export async function locateMapAddress(address: string, signal: AbortSignal): Promise<MapPoint> {
  const point = parseCoordinateAddress(address);
  if (point) return point;
  if (/^(SAI Airport|Siem Reap Angkor International Airport)(, Cambodia| \(SAI\), Cambodia)?$/i.test(address.trim())) {
    return { latitude: 13.3692, longitude: 104.2231 };
  }
  const places = await searchPlaces(address, signal);
  const first = places[0];
  if (!first) throw new Error("Address not found");
  const { latitude, longitude } = first;
  return { latitude, longitude };
}

export async function routeMapPoints(from: MapPoint, to: MapPoint, signal: AbortSignal): Promise<RouteResult> {
  const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const response = await fetch(`${routingUrl.replace(/\/$/, "")}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { signal });
  if (!response.ok) throw new Error("Routing unavailable");
  const data = await response.json() as {
    routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
  };
  const route = data.routes?.[0];
  if (!route || route.geometry.coordinates.length < 2) throw new Error("No route");
  return {
    points: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
    distance: route.distance,
    duration: route.duration,
  };
}
