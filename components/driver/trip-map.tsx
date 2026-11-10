"use client";

import { localizedNumber } from "@/lib/locale-format";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Course } from "@/components/booking/course-dashboard";
import { demoLocations, type Coordinates } from "@/lib/driver-dashboard";
import { locateMapAddress, mapTileAttribution, mapTileUrl, routeMapPoints } from "@/lib/map-client";
import { useLanguage } from "@/components/i18n/language-provider";

export async function locate(address: string, demo: boolean, signal: AbortSignal): Promise<Coordinates> {
  if (demo && demoLocations[address]) return demoLocations[address];
  const point = await locateMapAddress(address, signal);
  return [point.latitude, point.longitude];
}

export default function TripMap({ course, demo }: { course: Course; demo: boolean }) {
  const { t, language } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<{ phase: "loading" | "ready" | "routeUnavailable" | "error"; distance?: number; duration?: number }>({ phase: "loading" });
  const [tilesFailed, setTilesFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([13.38, 104.02], 10);
    const tiles = L.tileLayer(mapTileUrl, { attribution: mapTileAttribution, maxZoom: 19 }).addTo(map);
    tiles.on("tileerror", () => setTilesFailed(true));
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(18_000)]);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    async function draw() {
      try {
        if (course.pricingStatus === "AWAITING_DESTINATION") {
          const point = await locate(course.fromAddress, demo, signal);
          if (controller.signal.aborted) return;
          L.circleMarker(point, { radius: 9, color: "#fff", weight: 3, fillColor: "#032ea1", fillOpacity: 1 }).addTo(map);
          map.setView(point, 16, { animate: false });
          setState({ phase: "ready" });
          return;
        }
        const [from, to] = await Promise.all([locate(course.fromAddress, demo, signal), locate(course.toAddress, demo, signal)]);
        if (controller.signal.aborted) return;
        for (const [point, label, color] of [[from, course.fromAddress, "#032ea1"], [to, course.toAddress, "#e00025"]] as const) {
          const tooltip = document.createElement("span");
          tooltip.textContent = label;
          L.circleMarker(point, { radius: 9, color: "#fff", weight: 3, fillColor: color, fillOpacity: 1 }).addTo(map).bindTooltip(tooltip);
        }
        map.fitBounds(L.latLngBounds([from, to]), { padding: [35, 35], maxZoom: 14, animate: false });
        try {
          const route = await routeMapPoints({ latitude: from[0], longitude: from[1] }, { latitude: to[0], longitude: to[1] }, signal);
          if (controller.signal.aborted) return;
          const routeColor = course.status === "TRIP_STARTED" ? "#F58220"
            : ["DRIVER_ASSIGNED", "DRIVER_ACCEPTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"].includes(course.status) ? "#D6A000" : "#808080";
          const line = L.polyline(route.points, { color: routeColor, weight: 5, opacity: 0.85 }).addTo(map);
          line.bringToBack();
          map.fitBounds(line.getBounds(), { padding: [35, 35], animate: false });
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
  }, [course.fromAddress, course.toAddress, course.status, course.pricingStatus, demo]);

  return <div className="relative">
    <div ref={container} className="relative z-0 h-80 w-full bg-slate-100 sm:h-97.5" role="region" aria-label={t("driver.map")} />
    <div className="border-t border-slate-200 bg-white px-4 py-3 text-sm" aria-live="polite">
      {state.phase === "ready" ? course.pricingStatus === "AWAITING_DESTINATION" ? t("guest.price") : <><strong>{localizedNumber(language, { maximumFractionDigits: 1 }).format((state.distance ?? 0) / 1000)} {t("driver.kilometer")} · {Math.ceil((state.duration ?? 0) / 60)} {t("driver.minute")}</strong><span className="ml-2 text-slate-500">{t("driver.routeEstimate")}</span></> : t(state.phase === "loading" ? "driver.routeLoading" : state.phase === "error" ? "driver.routeError" : "driver.routeUnavailable")}
      {tilesFailed && <p className="mt-1 text-red-700" role="alert">{t("driver.mapTilesError")}</p>}
    </div>
  </div>;
}