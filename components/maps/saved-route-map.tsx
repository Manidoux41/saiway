"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { routeDetailsSchema, type SavedRoute } from "@/lib/route-details";
import type { LocationPoint } from "@/lib/booking-location";
import type { VehicleIconCategory } from "@prisma/client";
import { mapTileAttribution, mapTileUrl, vehicleMarkerIcon } from "@/lib/map-client";
import { useLanguage } from "@/components/i18n/language-provider";

export function SavedRouteMap({ route, position, vehicle }: { route: SavedRoute; position?: (LocationPoint & { heading?: number | null }) | null; vehicle?: { id: string; iconCategory: VehicleIconCategory } | null }) {
  const { t } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const marker = useRef<L.Marker | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [tileError, setTileError] = useState(false);
  const routeKey = JSON.stringify(route);
  useEffect(() => {
    if (!container.current) return;
    const saved = routeDetailsSchema.parse(JSON.parse(routeKey));
    const map = L.map(container.current, { scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer(mapTileUrl, { attribution: mapTileAttribution, maxZoom: 19 }).on("tileerror", () => setTileError(true)).addTo(map);
    const line = L.polyline(saved.coordinates.map(([lon, lat]) => [lat, lon]), { color: "#F58220", weight: 5 }).addTo(map);
    L.circleMarker([saved.from.latitude, saved.from.longitude], { radius: 8, color: "#032ea1", fillOpacity: 1 }).addTo(map).bindTooltip(t("booking.from"));
    L.circleMarker([saved.to.latitude, saved.to.longitude], { radius: 8, color: "#F58220", fillOpacity: 1 }).addTo(map).bindTooltip(t("booking.to"));
    map.fitBounds(line.getBounds().extend([saved.from.latitude, saved.from.longitude]).extend([saved.to.latitude, saved.to.longitude]), { padding: [25, 25], maxZoom: 15 });
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); marker.current = null; mapRef.current = null; map.remove(); };
  }, [routeKey, t]);
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!position) { marker.current?.remove(); marker.current = null; return; }
    const point: L.LatLngTuple = [position.latitude, position.longitude];
    const icon = vehicleMarkerIcon(vehicle?.iconCategory ?? "OTHER", position.heading ?? null, vehicle ? `/api/vehicles/${encodeURIComponent(vehicle.id)}/icon` : null);
    if (!marker.current) marker.current = L.marker(point, { icon, zIndexOffset: 1000 }).addTo(map);
    else marker.current.setLatLng(point).setIcon(icon);
    marker.current.getElement()?.style.setProperty("transition", "transform 0.9s linear");
  }, [position, vehicle, routeKey, t]);
  return <div>{tileError && <p role="alert" className="p-2 text-sm text-amber-800">{t("fleet.tilesError")}</p>}<div ref={container} role="region" aria-label={t("driver.map")} className="relative z-0 h-80 w-full rounded-2xl bg-slate-100 sm:h-96" /></div>;
}
