"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { mapTileAttribution, mapTileUrl, locateMapAddress, routeMapPoints, vehicleMarkerIcon, type MapPoint } from "@/lib/map-client";
import { useLanguage } from "@/components/i18n/language-provider";

export type FleetHub = { id: string; name: string; address: string | null; latitude: number; longitude: number };
export type FleetDriverStatus = "AVAILABLE" | "ASSIGNED" | "TO_PICKUP" | "ON_TRIP" | "RETURNING_TO_HUB";
export type FleetDriver = {
  id: string;
  name: string;
  status: FleetDriverStatus;
  location: (MapPoint & { heading: number | null; accuracy: number | null; recordedAt: string }) | null;
  booking: { id: string; reference: string; status: string } | null;
  vehicle: { id: string; name: string; plate: string; iconCategory: "TUK_TUK" | "PASSAPP" | "SEDAN" | "SUV" | "MINIVAN" | "MINIBUS" | "VAN" | "OTHER" } | null;
  target: { address: string | null; hub: FleetHub | null } | null;
  stale: boolean;
};

const routeColors: Record<string, string> = {
  ASSIGNED: "#D6A000",
  TO_PICKUP: "#D6A000",
  ON_TRIP: "#F58220",
  RETURNING_TO_HUB: "#2E9D50",
};
const statusLabels = {
  AVAILABLE: "fleet.available",
  ASSIGNED: "fleet.assigned",
  TO_PICKUP: "fleet.toPickup",
  ON_TRIP: "fleet.onTrip",
  RETURNING_TO_HUB: "fleet.returning",
} as const satisfies Record<FleetDriverStatus, string>;

function textNode(value: string) {
  const element = document.createElement("span");
  element.textContent = value;
  return element;
}

export function FleetMap({ drivers, hubs, selectedId, onSelect, height = "480px" }: { drivers: FleetDriver[]; hubs: FleetHub[]; selectedId: string | null; onSelect?: (id: string) => void; height?: string }) {
  const { t, language } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markers = useRef(new Map<string, L.Marker>());
  const animations = useRef(new Map<string, number>());
  const hubLayer = useRef<L.LayerGroup | null>(null);
  const routeLayers = useRef<L.LayerGroup | null>(null);
  const driversRef = useRef(drivers);
  const [tileError, setTileError] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [routeMetrics, setRouteMetrics] = useState<Record<string, { distance: number; eta: string }>>({});

  useEffect(() => {
    driversRef.current = drivers;
  }, [drivers]);

  useEffect(() => {
    if (!container.current) return;
    const activeAnimations = animations.current;
    const activeMarkers = markers.current;
    const map = L.map(container.current, { scrollWheelZoom: true }).setView([13.38, 104.02], 10);
    mapRef.current = map;
    L.tileLayer(mapTileUrl, { attribution: mapTileAttribution, maxZoom: 19 }).addTo(map).on("tileerror", () => setTileError(true));
    hubLayer.current = L.layerGroup().addTo(map);
    routeLayers.current = L.layerGroup().addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => {
      observer.disconnect();
      activeAnimations.forEach((frame) => cancelAnimationFrame(frame));
      activeAnimations.clear();
      activeMarkers.clear();
      map.remove();
      mapRef.current = null;
      hubLayer.current = null;
      routeLayers.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = hubLayer.current;
    if (!map || !layer) return;
    layer.clearLayers();
    hubs.forEach((hub) => {
      const icon = L.divIcon({ className: "", html: '<span class="saiway-hub-marker">H</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
      L.marker([hub.latitude, hub.longitude], { icon, keyboard: true }).addTo(layer).bindTooltip(textNode(hub.name));
    });
  }, [hubs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const activeIds = new Set(drivers.filter((driver) => driver.location).map((driver) => driver.id));
    for (const [id, marker] of markers.current) {
      if (!activeIds.has(id)) {
        const frame = animations.current.get(id);
        if (frame) cancelAnimationFrame(frame);
        animations.current.delete(id);
        marker.remove();
        markers.current.delete(id);
      }
    }
    drivers.forEach((driver) => {
      if (!driver.location) return;
      const point: [number, number] = [driver.location.latitude, driver.location.longitude];
      const icon = vehicleMarkerIcon(driver.vehicle?.iconCategory ?? "OTHER", driver.location.heading, driver.vehicle ? `/api/vehicles/${encodeURIComponent(driver.vehicle.id)}/icon` : null);
      let marker = markers.current.get(driver.id);
      if (!marker) {
        marker = L.marker(point, { icon, zIndexOffset: 1000, keyboard: true }).addTo(map);
        marker.on("click", () => onSelect?.(driver.id));
        markers.current.set(driver.id, marker);
      } else {
        const start = marker.getLatLng();
        const began = performance.now();
        const previousFrame = animations.current.get(driver.id);
        if (previousFrame) cancelAnimationFrame(previousFrame);
        const animate = (time: number) => {
          const progress = Math.min(1, (time - began) / 900);
          marker!.setLatLng([start.lat + (point[0] - start.lat) * progress, start.lng + (point[1] - start.lng) * progress]);
          if (progress < 1) animations.current.set(driver.id, requestAnimationFrame(animate));
          else animations.current.delete(driver.id);
        };
        animations.current.set(driver.id, requestAnimationFrame(animate));
        marker.setIcon(icon);
      }
      marker.bindTooltip(textNode(`${driver.name}${driver.vehicle ? ` · ${driver.vehicle.name}` : ""}`), { direction: "top" });
      marker.bindPopup(textNode([
        driver.name,
        t(statusLabels[driver.status]),
        driver.vehicle ? `${driver.vehicle.name} · ${driver.vehicle.plate}` : "",
        driver.booking?.reference ?? "",
      ].filter(Boolean).join(" · ")));
    });
  }, [drivers, onSelect, t]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const selected = driversRef.current.find((driver) => driver.id === selectedId)?.location;
    if (selected) map.setView([selected.latitude, selected.longitude], Math.max(map.getZoom(), 15), { animate: true });
  }, [selectedId]);

  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayers.current;
    if (!map || !routeLayer) return;
    const activeRouteLayer: L.LayerGroup = routeLayer;
    let controller = new AbortController();
    async function updateRoutes() {
      activeRouteLayer.clearLayers();
      let failed = false;
      const metrics: Record<string, { distance: number; eta: string }> = {};
      await Promise.all(driversRef.current.map(async (driver) => {
        const location = driver.location;
        if (!location || !driver.target) return;
        const color = routeColors[driver.status];
        if (!color) return;
        try {
          const destination = driver.target?.hub
            ? { latitude: driver.target.hub.latitude, longitude: driver.target.hub.longitude }
            : driver.target?.address ? await locateMapAddress(driver.target.address, controller.signal) : null;
          if (!destination || controller.signal.aborted) return;
          const route = await routeMapPoints(location, destination, controller.signal);
          if (controller.signal.aborted) return;
          L.polyline(route.points, { color, weight: 5, opacity: 0.76, dashArray: "8 9" }).addTo(activeRouteLayer);
          metrics[driver.id] = { distance: route.distance, eta: formatEta(route.duration, language) };
        } catch {
          if (!controller.signal.aborted) failed = true;
        }
      }));
      if (!controller.signal.aborted) {
        setRouteError(failed);
        setRouteMetrics(metrics);
      }
    }
    void updateRoutes();
    const timer = window.setInterval(() => {
      controller.abort();
      controller = new AbortController();
      void updateRoutes();
    }, 15_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [language]);

  const routeDriver = drivers.find((driver) => driver.id === selectedId) ?? (drivers.length === 1 ? drivers[0] : null);
  const selectedRoute = routeDriver ? routeMetrics[routeDriver.id] : null;
  return <div className="relative w-full" style={{ height }}>
    <div ref={container} className="h-full w-full bg-slate-100" role="region" aria-label={t("fleet.map")} />
    {selectedRoute && <p className="absolute left-3 top-3 z-[500] rounded bg-white/95 p-2 text-sm shadow" aria-live="polite">
      {t("fleet.remaining")}: {new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(selectedRoute.distance / 1000)} km · {t("fleet.eta")}: {selectedRoute.eta}
    </p>}
    {tileError && <p role="alert" className="absolute bottom-10 left-3 right-3 z-[500] rounded bg-white/95 p-2 text-sm text-red-700 shadow">{t("fleet.tilesError")}</p>}
    {routeError && <p role="status" className="absolute bottom-3 left-3 right-3 z-[500] rounded bg-white/95 p-2 text-sm text-amber-800 shadow">{t("fleet.routeError")}</p>}
  </div>;
}

function formatEta(durationSeconds: number, language: string) {
  const arrival = Date.now() + Math.ceil(durationSeconds / 60) * 60_000;
  return new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(arrival);
}
