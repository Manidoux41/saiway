"use client";

import { useEffect, useRef, useState } from "react";

export type SharingPhase = "starting" | "sharing" | "denied" | "unavailable" | "timeout" | "unsupported" | "error" | "inactive";
type Fix = { latitude: number; longitude: number; accuracy: number | null; heading: number | null };
type Hub = { id: string; name: string; address: string | null; latitude: number; longitude: number };
type Vehicle = { id: string; name: string; plate: string; iconCategory: "TUK_TUK" | "PASSAPP" | "SEDAN" | "SUV" | "MINIVAN" | "MINIBUS" | "VAN" | "OTHER" };

const minIntervalMs = 5_000;
const heartbeatMs = 15_000;
const minMoveMeters = 15;

export function distanceMeters(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (value: number) => value * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Shares one driver GPS stream with operations and, for an assigned active trip, its customer. */
export function useLocationSharing(bookingId: string | null, enabled: boolean) {
  const [state, setState] = useState<{ bookingId: string | null; attempt: number; phase: SharingPhase; lastSent: Date | null; point: Fix | null; returningToHub: boolean; hubs: Hub[]; vehicle: Vehicle | null }>({ bookingId: null, attempt: 0, phase: "starting", lastSent: null, point: null, returningToHub: false, hubs: [], vehicle: null });
  const [attempt, setAttempt] = useState(0);
  const [detectedAt, setDetectedAt] = useState<Date | null>(null);
  const last = useRef<{ fix: Fix; at: number } | null>(null);
  const pending = useRef<Fix | null>(null);
  const latest = useRef<Fix | null>(null);
  const acquiredAt = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let watch: number | null = null;
    let heartbeat = 0;
    let wakeLock: WakeLockSentinel | null = null;
    const update = (phase: SharingPhase, lastSent?: Date, point?: Fix, returningToHub?: boolean, hubs?: Hub[], vehicle?: Vehicle | null) => setState((current) => ({
      bookingId, attempt, phase,
      lastSent: lastSent ?? (current.bookingId === bookingId ? current.lastSent : null),
      point: point ?? (current.bookingId === bookingId ? current.point : null),
      returningToHub: returningToHub ?? (current.bookingId === bookingId ? current.returningToHub : false),
      hubs: hubs ?? (current.bookingId === bookingId ? current.hubs : []),
      vehicle: vehicle === undefined ? current.bookingId === bookingId ? current.vehicle : null : vehicle,
    }));
    if (!("geolocation" in navigator)) {
      update("unsupported");
      return () => { stopped = true; };
    }
    last.current = null;
    pending.current = null;
    latest.current = null;
    acquiredAt.current = 0;

    async function send(fix: Fix) {
      if (inFlight.current) { pending.current = fix; return; }
      inFlight.current = true;
      try {
        const response = await fetch("/api/driver/location", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fix), signal: AbortSignal.timeout(15_000) });
        if (stopped) return;
        if (!response.ok) throw new Error("Location rejected");
        const result = await response.json() as { accepted?: boolean; recordedAt?: string; returningToHub?: boolean };
        if (result.accepted === false) {
          last.current = { fix, at: result.recordedAt ? new Date(result.recordedAt).getTime() : Date.now() };
          update("sharing", undefined, fix, result.returningToHub);
          return;
        }
        last.current = { fix, at: Date.now() };
        update("sharing", result.recordedAt ? new Date(result.recordedAt) : new Date(), fix, result.returningToHub);
      } catch {
        if (!stopped) update("error", undefined, fix);
      } finally {
        inFlight.current = false;
        const queued = pending.current;
        pending.current = null;
        if (queued && !stopped) void send(queued);
      }
    }

    function onPosition(position: GeolocationPosition) {
      const fix = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        heading: Number.isFinite(position.coords.heading) && position.coords.heading !== null ? position.coords.heading : null,
      };
      latest.current = fix;
      acquiredAt.current = position.timestamp;
      setDetectedAt(new Date(position.timestamp));
      setState((current) => ({ ...current, bookingId, attempt, point: fix }));
      const previous = last.current;
      const elapsed = previous ? Date.now() - previous.at : Infinity;
      if (!previous || elapsed >= minIntervalMs || elapsed >= 2_000 && distanceMeters(previous.fix, fix) >= minMoveMeters) void send(fix);
    }

    function onError(error: GeolocationPositionError) {
      update(error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable");
    }

    async function keepAwake() {
      try { if (document.visibilityState === "visible" && "wakeLock" in navigator && !stopped) wakeLock = await navigator.wakeLock.request("screen"); } catch { /* best effort */ }
    }

    async function start() {
      try {
        const response = await fetch("/api/driver/location", { cache: "no-store", signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error("Location sharing status unavailable");
        const data = await response.json() as { enabled: boolean; returningToHub: boolean; hubs: Hub[]; location: (Fix & { recordedAt: string }) | null; vehicle: Vehicle | null };
        if (stopped) return;
        const recentLocation = data.location && Date.now() - new Date(data.location.recordedAt).getTime() <= 120_000 ? data.location : null;
        update(data.enabled ? "starting" : "inactive", recentLocation ? new Date(recentLocation.recordedAt) : undefined, recentLocation ?? undefined, data.returningToHub, data.hubs, data.vehicle);
        if (!data.enabled) return;
        watch = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
        void keepAwake();
        document.addEventListener("visibilitychange", keepAwake);
        heartbeat = window.setInterval(() => {
          const fix = latest.current;
          const elapsed = last.current ? Date.now() - last.current.at : Infinity;
          if (fix && Date.now() - acquiredAt.current <= 60000 && (elapsed >= heartbeatMs || fix !== last.current?.fix && elapsed >= minIntervalMs)) void send(fix);
        }, 5_000);
      } catch {
        if (!stopped) update("error");
      }
    }
    void start();
    return () => {
      stopped = true;
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", keepAwake);
      void wakeLock?.release().catch(() => undefined);
    };
  }, [bookingId, attempt, enabled]);

  const current = state.bookingId === bookingId && state.attempt === attempt;
  return {
    phase: current ? state.phase : "starting" as SharingPhase,
    lastSent: current ? state.lastSent : null,
    point: current ? state.point : null,
    detectedAt: current ? detectedAt : null,
    returningToHub: current && state.returningToHub,
    hubs: current ? state.hubs : [],
    vehicle: current ? state.vehicle : null,
    retry: () => setAttempt((value) => value + 1),
  };
}
