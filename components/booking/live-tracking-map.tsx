"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { locateMapAddress, mapTileAttribution, mapTileUrl, routeMapPoints, vehicleMarkerIcon } from "@/lib/map-client";

export type LivePoint = { latitude: number; longitude: number; accuracy: number | null; heading?: number | null };
type HistoryPoint = { latitude: number; longitude: number; recordedAt: string };
type Labels = {
  map: string; driver: string; you: string; pickup: string; destination: string; tiles: string;
  eta: string; remaining: string; routeUnavailable: string; routeLoading: string;
};
type VehicleIconCategory = "TUK_TUK" | "PASSAPP" | "SEDAN" | "SUV" | "MINIVAN" | "MINIBUS" | "VAN" | "OTHER";

function label(text: string) {
  const element = document.createElement("span");
  element.textContent = text;
  return element;
}

export default function LiveTrackingMap({ fromAddress, toAddress, driver, me, status, history, vehicle, recenter, labels, fullScreen = false }: {
  fromAddress: string;
  toAddress: string;
  driver: LivePoint & { recordedAt: string } | null;
  me: LivePoint | null;
  status: string;
  history: HistoryPoint[];
  vehicle: { id: string; iconCategory: VehicleIconCategory } | null;
  recenter: number;
  labels: Labels;
  fullScreen?: boolean;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const places = useRef<{ from: L.LatLng | null; to: L.LatLng | null }>({ from: null, to: null });
  const driverMarker = useRef<L.Marker | null>(null);
  const driverAccuracy = useRef<L.Circle | null>(null);
  const meMarker = useRef<L.CircleMarker | null>(null);
  const meAccuracy = useRef<L.Circle | null>(null);
  const historyLayer = useRef<L.LayerGroup | null>(null);
  const routeLayer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);
  const animation = useRef(0);
  const routeController = useRef<AbortController | null>(null);
  const routeInFlight = useRef(false);
  const routeRequestKey = useRef("");
  const routeRetry = useRef<{ key: string; after: number } | null>(null);
  const routeTimer = useRef(0);
  const routeCache = useRef<{ key: string; at: number; points: [number, number][]; distance: number; duration: number } | null>(null);
  const [routeTick, setRouteTick] = useState(0);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [routeStatus, setRouteStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [route, setRoute] = useState<{ distance: number; duration: number; eta: string } | null>(null);
  const labelsRef = useRef(labels);
  useEffect(() => { labelsRef.current = labels; }, [labels]);

  function fit() {
    const map = mapRef.current;
    if (!map) return;
    const points = [driverMarker.current?.getLatLng(), meMarker.current?.getLatLng()].filter((point): point is L.LatLng => Boolean(point));
    const target = points.length ? points : [places.current.from, places.current.to].filter((point): point is L.LatLng => Boolean(point));
    if (!target.length) return;
    if (target.length === 1) map.setView(target[0], Math.max(map.getZoom(), 15));
    else map.fitBounds(L.latLngBounds(target), { padding: [50, 50], maxZoom: 16 });
  }

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([13.38, 104.02], 11);
    mapRef.current = map;
    L.tileLayer(mapTileUrl, { attribution: mapTileAttribution, maxZoom: 19 }).addTo(map).on("tileerror", () => setTilesFailed(true));
    historyLayer.current = L.layerGroup().addTo(map);
    routeLayer.current = L.layerGroup().addTo(map);
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container.current);
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(18_000)]);
    void Promise.allSettled([locateMapAddress(fromAddress, signal), locateMapAddress(toAddress, signal)]).then((results) => {
      if (controller.signal.aborted) return;
      results.forEach((result, index) => {
        if (result.status !== "fulfilled") return;
        const point = L.latLng(result.value.latitude, result.value.longitude);
        if (index === 0) places.current.from = point;
        else places.current.to = point;
        L.circleMarker(point, { radius: 8, color: "#fff", weight: 3, fillColor: index === 0 ? "#032ea1" : "#e00025", fillOpacity: 1 })
          .addTo(map).bindTooltip(label(`${index === 0 ? labelsRef.current.pickup : labelsRef.current.destination} · ${index === 0 ? fromAddress : toAddress}`));
      });
      if (!fitted.current) fit();
    });
    return () => {
      controller.abort();
      observer.disconnect();
      cancelAnimationFrame(animation.current);
      window.clearTimeout(routeTimer.current);
      routeController.current?.abort();
      map.remove();
      mapRef.current = null;
      driverMarker.current = null;
      driverAccuracy.current = null;
      meMarker.current = null;
      meAccuracy.current = null;
      historyLayer.current = null;
      routeLayer.current = null;
      places.current = { from: null, to: null };
      fitted.current = false;
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
    const category = vehicle?.iconCategory ?? "OTHER";
    const icon = vehicleMarkerIcon(category, driver.heading ?? null, vehicle ? `/api/vehicles/${encodeURIComponent(vehicle.id)}/icon` : null);
    if (!driverMarker.current) {
      driverMarker.current = L.marker(target, { icon, zIndexOffset: 1000, keyboard: false }).addTo(map)
        .bindTooltip(label(labelsRef.current.driver), { permanent: true, direction: "top", offset: [0, -18] });
      driverAccuracy.current = L.circle(target, { radius: driver.accuracy ?? 0, color: "#D6A000", weight: 1, opacity: 0.4, fillOpacity: 0.08, interactive: false }).addTo(map);
    } else {
      const marker = driverMarker.current;
      const start = marker.getLatLng();
      const begin = performance.now();
      cancelAnimationFrame(animation.current);
      const step = (time: number) => {
        const progress = Math.min(1, (time - begin) / 900);
        marker.setLatLng([start.lat + (target.lat - start.lat) * progress, start.lng + (target.lng - start.lng) * progress]);
        if (progress < 1) animation.current = requestAnimationFrame(step);
      };
      animation.current = requestAnimationFrame(step);
      marker.setIcon(icon);
      driverAccuracy.current?.setLatLng(target).setRadius(driver.accuracy ?? 0);
    }
    if (!fitted.current) { fitted.current = true; fit(); }
  }, [driver, vehicle]);

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

  useEffect(() => {
    const layer = historyLayer.current;
    if (!layer) return;
    layer.clearLayers();
    const color = status === "TRIP_STARTED" ? "#F58220" : "#D6A000";
    const travelled = history.slice(-120).map((point) => [point.latitude, point.longitude] as [number, number]);
    if (travelled.length > 1) L.polyline(travelled, { color, weight: 5, opacity: 0.88 }).addTo(layer);
  }, [history, status]);

  useEffect(() => {
    const layer = routeLayer.current;
    if (!layer) return;
    const color = status === "TRIP_STARTED" ? "#F58220" : "#D6A000";
    if (!driver) {
      layer.clearLayers();
      routeController.current?.abort();
      routeController.current = null;
      routeInFlight.current = false;
      routeRequestKey.current = "";
      routeRetry.current = null;
      window.clearTimeout(routeTimer.current);
      routeTimer.current = 0;
      return;
    }
    const destination = status === "TRIP_STARTED" ? places.current.to : places.current.from;
    if (!destination) {
      layer.clearLayers();
      routeController.current?.abort();
      routeController.current = null;
      routeInFlight.current = false;
      routeRequestKey.current = "";
      routeRetry.current = null;
      return;
    }
    const key = `${status}:${destination.lat}:${destination.lng}`;
    if (routeRetry.current?.key !== key) routeRetry.current = null;
    if (routeRetry.current && Date.now() < routeRetry.current.after) return;
    if (routeInFlight.current && routeRequestKey.current !== key) {
      routeController.current?.abort();
      routeInFlight.current = false;
    }
    const cached = routeCache.current;
    layer.clearLayers();
    if (cached?.key === key && Date.now() - cached.at < 12_000) {
      L.polyline(cached.points, { color, weight: 5, opacity: 0.7, dashArray: "8 9" }).addTo(layer);
      setRoute({ distance: cached.distance, duration: cached.duration, eta: formatEta(cached.duration) });
      setRouteStatus("ready");
      if (!routeTimer.current) routeTimer.current = window.setTimeout(() => { routeTimer.current = 0; setRouteTick((value) => value + 1); }, Math.max(0, 12_000 - (Date.now() - cached.at)));
      return;
    }
    if (routeInFlight.current) return;
    const controller = new AbortController();
    routeController.current = controller;
    routeInFlight.current = true;
    routeRequestKey.current = key;
    setRouteStatus("loading");
    void routeMapPoints(
      { latitude: driver.latitude, longitude: driver.longitude },
      { latitude: destination.lat, longitude: destination.lng },
      AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
    ).then((result) => {
      if (controller.signal.aborted) return;
      layer.clearLayers();
      L.polyline(result.points, { color, weight: 5, opacity: 0.7, dashArray: "8 9" }).addTo(layer);
      routeCache.current = { key, at: Date.now(), points: result.points, distance: result.distance, duration: result.duration };
      routeRetry.current = null;
      setRoute({ distance: result.distance, duration: result.duration, eta: formatEta(result.duration) });
      setRouteStatus("ready");
    }).catch(() => {
      if (!controller.signal.aborted) {
        routeRetry.current = { key, after: Date.now() + 15_000 };
        setRouteStatus("error");
      }
    }).finally(() => {
      if (routeController.current === controller) {
        routeInFlight.current = false;
        routeController.current = null;
      }
    });
  }, [driver, status, fromAddress, toAddress, routeTick]);

  useEffect(() => { if (recenter) fit(); }, [recenter]);

  const eta = route?.eta ?? null;

  return <div className="relative">
    <div ref={container} style={fullScreen ? { height: "100%" } : undefined} className={`relative z-0 w-full bg-slate-100 ${fullScreen ? "h-full" : "h-[420px] sm:h-[520px]"}`} role="region" aria-label={labels.map} />
    {driver && <div className="absolute left-3 top-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-sm shadow" aria-live="polite">
      {routeStatus === "ready" && route && eta ? <strong>{labels.remaining}: {(route.distance / 1000).toFixed(1)} km · {labels.eta}: {eta}</strong> : routeStatus === "error" ? <span role="status">{labels.routeUnavailable}</span> : <span>{labels.routeLoading}</span>}
    </div>}
    {tilesFailed && <p className="absolute inset-x-3 bottom-3 z-[500] rounded bg-white/95 px-3 py-2 text-sm text-red-700 shadow" role="alert">{labels.tiles}</p>}
  </div>;
}

function formatEta(durationSeconds: number) {
  const arrival = Date.now() + Math.ceil(durationSeconds / 60) * 60_000;
  return new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(arrival);
}
