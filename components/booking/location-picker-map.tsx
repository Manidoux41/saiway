"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { mapTileUrl, mapTileAttribution } from "@/lib/map-client";
import type { LocationPoint } from "@/lib/booking-location";
import { useLanguage } from "@/components/i18n/language-provider";

export default function LocationPickerMap({ point, onSelect }: { point: LocationPoint | null; onSelect: (point: LocationPoint) => void }) {
  const { t } = useLanguage();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const callback = useRef(onSelect);
  const [tileError, setTileError] = useState(false);
  useEffect(() => { callback.current = onSelect; }, [onSelect]);
  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current).setView([13.36, 103.85], 13);
    mapRef.current = map;
    L.tileLayer(mapTileUrl, { attribution: mapTileAttribution, maxZoom: 19 }).addTo(map).on("tileerror", () => setTileError(true));
    map.on("click", (event: L.LeafletMouseEvent) => callback.current({ latitude: event.latlng.lat, longitude: event.latlng.wrap().lng }));
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !point) return;
    if (markerRef.current) markerRef.current.setLatLng([point.latitude, point.longitude]);
    else markerRef.current = L.marker([point.latitude, point.longitude], { icon: L.divIcon({ className: "", html: '<span style="display:block;width:22px;height:22px;border-radius:50%;background:#D6A000;border:3px solid white;box-shadow:0 1px 8px #333"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(map);
    map.panTo([point.latitude, point.longitude]);
  }, [point]);
  return <div><div ref={container} role="region" aria-label={t("places.pickMap")} className="relative z-0 h-72 rounded-2xl bg-slate-100" />{tileError && <p role="alert" className="text-sm text-red-700">{t("fleet.tilesError")}</p>}</div>;
}
