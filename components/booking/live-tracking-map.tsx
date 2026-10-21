"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { locate } from "@/components/driver/trip-map";
import styles from "./live-tracking.module.css";

export type LivePoint = { latitude: number; longitude: number; accuracy: number | null };
type Labels = { map: string; driver: string; you: string; pickup: string; destination: string; tiles: string };

function label(text: string) {
  const element = document.createElement("span");
  element.textContent = text;
  return element;
}

export default function LiveTrackingMap({ fromAddress, toAddress, driver, me, recenter, labels }: { fromAddress: string; toAddress: string; driver: LivePoint | null; me: LivePoint | null; recenter: number; labels: Labels }) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const places = useRef<L.LatLng[]>([]);
  const driverMarker = useRef<L.Marker | null>(null);
  const driverAccuracy = useRef<L.Circle | null>(null);
  const meMarker = useRef<L.CircleMarker | null>(null);
  const meAccuracy = useRef<L.Circle | null>(null);
  const fitted = useRef(false);
  const animation = useRef(0);
  const [tilesFailed, setTilesFailed] = useState(false);
  const labelsRef = useRef(labels);
  useEffect(() => { labelsRef.current = labels; }, [labels]);

  function fit() {
    const map = mapRef.current;
    if (!map) return;
    const points = [driverMarker.current?.getLatLng(), meMarker.current?.getLatLng()].filter((point): point is L.LatLng => Boolean(point));
    const target = points.length ? points : places.current;
    if (!target.length) return;
    if (target.length === 1) map.setView(target[0], Math.max(map.getZoom(), 15));
    else map.fitBounds(L.latLngBounds(target), { padding: [50, 50], maxZoom: 16 });
  }

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([13.38, 104.02], 11);
    mapRef.current = map;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).addTo(map);
    tiles.on("tileerror", () => setTilesFailed(true));
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(18_000)]);
    void Promise.allSettled([locate(fromAddress, false, signal), locate(toAddress, false, signal)]).then((results) => {
      if (controller.signal.aborted) return;
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const point = L.latLng(result.value);
        places.current.push(point);
        L.circleMarker(point, { radius: 8, color: "#fff", weight: 3, fillColor: index === 0 ? "#032ea1" : "#e00025", fillOpacity: 1 })
          .addTo(map).bindTooltip(label(`${index === 0 ? labelsRef.current.pickup : labelsRef.current.destination} · ${index === 0 ? fromAddress : toAddress}`));
      });
      if (!fitted.current) fit();
    });
    return () => {
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(animation.current);
      map.remove();
      mapRef.current = null;
      driverMarker.current = null; driverAccuracy.current = null; meMarker.current = null; meAccuracy.current = null;
      places.current = []; fitted.current = false;
    };
  }, [fromAddress, toAddress]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!driver) {
      driverMarker.current?.remove(); driverAccuracy.current?.remove();
      driverMarker.current = null; driverAccuracy.current = null;
      return;
    }
    const target = L.latLng(driver.latitude, driver.longitude);
    if (!driverMarker.current) {
      const icon = L.divIcon({ className: "", html: `<span class="${styles.driverPin}"><span></span></span>`, iconSize: [36, 36], iconAnchor: [18, 18] });
      driverMarker.current = L.marker(target, { icon, zIndexOffset: 1000, keyboard: false }).addTo(map).bindTooltip(label(labelsRef.current.driver), { permanent: true, direction: "top", offset: [0, -18] });
      driverAccuracy.current = L.circle(target, { radius: driver.accuracy ?? 0, color: "#e00025", weight: 1, opacity: 0.4, fillOpacity: 0.08, interactive: false }).addTo(map);
    } else {
      const marker = driverMarker.current;
      const start = marker.getLatLng();
      const begin = performance.now();
      cancelAnimationFrame(animation.current);
      // Glide between polled positions so the car moves smoothly instead of jumping every few seconds.
      const step = (time: number) => {
        const progress = Math.min(1, (time - begin) / 900);
        marker.setLatLng([start.lat + (target.lat - start.lat) * progress, start.lng + (target.lng - start.lng) * progress]);
        if (progress < 1) animation.current = requestAnimationFrame(step);
      };
      animation.current = requestAnimationFrame(step);
      driverAccuracy.current?.setLatLng(target).setRadius(driver.accuracy ?? 0);
    }
    if (!fitted.current) { fitted.current = true; fit(); }
  }, [driver]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!me) {
      meMarker.current?.remove(); meAccuracy.current?.remove();
      meMarker.current = null; meAccuracy.current = null;
      return;
    }
    const point = L.latLng(me.latitude, me.longitude);
    if (!meMarker.current) {
      meAccuracy.current = L.circle(point, { radius: me.accuracy ?? 0, color: "#2563eb", weight: 1, opacity: 0.5, fillOpacity: 0.12, interactive: false }).addTo(map);
      meMarker.current = L.circleMarker(point, { radius: 8, color: "#fff", weight: 3, fillColor: "#2563eb", fillOpacity: 1 }).addTo(map).bindTooltip(label(labelsRef.current.you), { permanent: true, direction: "bottom", offset: [0, 10] });
      if (driverMarker.current) fit();
    } else {
      meMarker.current.setLatLng(point);
      meAccuracy.current?.setLatLng(point).setRadius(me.accuracy ?? 0);
    }
  }, [me]);

  useEffect(() => { if (recenter) fit(); }, [recenter]);

  return <div className="relative">
    <div ref={container} className="relative z-0 h-[420px] w-full bg-slate-100 sm:h-[520px]" role="region" aria-label={labels.map} />
    {tilesFailed && <p className="absolute inset-x-3 bottom-3 z-[500] rounded bg-white/95 px-3 py-2 text-sm text-red-700 shadow" role="alert">{labels.tiles}</p>}
  </div>;
}
