"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { mapTileAttribution, mapTileUrl, vehicleMarkerIcon } from "@/lib/map-client";
import type { VehicleIconCategory } from "@prisma/client";
import { useLanguage } from "@/components/i18n/language-provider";

export function VehicleIconPreview({ vehicleId, category }: { vehicleId: string; category: VehicleIconCategory }) {
  const { t } = useLanguage();
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const point: [number, number] = [13.3612, 103.8601];
    const map = L.map(container.current, { scrollWheelZoom: false, dragging: false, zoomControl: false }).setView(point, 15);
    L.tileLayer(mapTileUrl, { attribution: mapTileAttribution, maxZoom: 19 }).addTo(map);
    L.marker(point, { icon: vehicleMarkerIcon(category, 0, `/api/vehicles/${encodeURIComponent(vehicleId)}/icon`), keyboard: false }).addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); };
  }, [category, vehicleId]);

  return <div ref={container} className="h-[320px] w-full rounded-xl bg-slate-100" role="region" aria-label={t("fleet.previewMap")} />;
}
