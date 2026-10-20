"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Course } from "@/components/booking/course-dashboard";
import { demoLocations, type Coordinates } from "@/lib/driver-dashboard";
import { useLanguage } from "@/components/i18n/language-provider";

const pointSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);
const geocodeSchema = z.object({ features: z.array(z.object({ geometry: z.object({ coordinates: pointSchema }) })) });
const routeSchema = z.object({ routes: z.array(z.object({ distance: z.number().nonnegative(), duration: z.number().nonnegative(), geometry: z.object({ coordinates: z.array(pointSchema).min(2) }) })) });

async function locate(address: string, demo: boolean, signal: AbortSignal): Promise<Coordinates> {
  if (demo && demoLocations[address]) return demoLocations[address];
  if (/^(SAI Airport|Siem Reap Angkor International Airport)(, Cambodia| \(SAI\), Cambodia)?$/i.test(address.trim())) return [13.3692, 104.2231];
  const params = new URLSearchParams({ q: address, limit: "1", bbox: "103.4,12.9,104.7,13.9" });
  const response = await fetch(`https://photon.komoot.io/api/?${params}`, { signal });
  if (!response.ok) throw new Error("Geocoding unavailable");
  const point = geocodeSchema.parse(await response.json()).features[0]?.geometry.coordinates;
  if (!point || point[0] < 103.4 || point[0] > 104.7 || point[1] < 12.9 || point[1] > 13.9) throw new Error("Address not found");
  return [point[1], point[0]];
}

export default function TripMap({ course, demo }: { course: Course; demo: boolean }) {
  const { t, language } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ phase: "loading" | "ready" | "routeUnavailable" | "error"; distance?: number; duration?: number }>({ phase: "loading" });
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([13.38, 104.02], 10);
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(map);
    tiles.on("tileerror", () => setTilesFailed(true));
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(18_000)]);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    async function draw() {
      try {
        const [from, to] = await Promise.all([locate(course.fromAddress, demo, signal), locate(course.toAddress, demo, signal)]);
        if (controller.signal.aborted) return;
        for (const [point, label, color] of [[from, course.fromAddress, "#032ea1"], [to, course.toAddress, "#e00025"]] as const) {
          const tooltip = document.createElement("span");
          tooltip.textContent = label;
          L.circleMarker(point, { radius: 9, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }).addTo(map).bindTooltip(tooltip);
        }
        map.fitBounds(L.latLngBounds([from, to]), { padding: [35, 35], maxZoom: 14 });
        try {
          const coordinates = `${from[1]},${from[0]};${to[1]},${to[0]}`;
          const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson`, { signal });
          if (!response.ok) throw new Error("Routing unavailable");
          const route = routeSchema.parse(await response.json()).routes[0];
          if (!route) throw new Error("No route");
          if (controller.signal.aborted) return;
          const points: Coordinates[] = route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]);
          const line = L.polyline(points, { color: "#032ea1", weight: 5, opacity: 0.85 }).addTo(map);
          line.bringToBack();
          map.fitBounds(line.getBounds(), { padding: [35, 35] });
          setState({ phase: "ready", distance: route.distance, duration: route.duration });
        } catch {
          if (!controller.signal.aborted) setState({ phase: "routeUnavailable" });
        }
      } catch {
        if (!controller.signal.aborted) setState({ phase: "error" });
      }
    }
    void draw();
    return () => { controller.abort(); observer.disconnect(); map.remove(); };
  }, [course.fromAddress, course.toAddress, demo]);

  return <div className="relative">
    <div ref={container} className="relative z-0 h-80 w-full bg-slate-100 sm:h-97.5" role="region" aria-label={t("driver.map")} />
    <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm" aria-live="polite">
      {state.phase === "ready" ? <><strong>{new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format((state.distance ?? 0) / 1000)} {t("driver.kilometer")} · {Math.ceil((state.duration ?? 0) / 60)} {t("driver.minute")}</strong><span className="ml-2 text-slate-500">{t("driver.routeEstimate")}</span></> : t(state.phase === "loading" ? "driver.routeLoading" : state.phase === "error" ? "driver.routeError" : "driver.routeUnavailable")}
      {tilesFailed && <p className="mt-1 text-red-700" role="alert">{t("driver.mapTilesError")}</p>}
    </div>
  </div>;
}