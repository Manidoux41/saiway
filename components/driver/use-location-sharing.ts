"use client";

import { useEffect, useState } from "react";

export type SharingPhase = "starting" | "sharing" | "denied" | "unavailable" | "timeout" | "unsupported" | "error" | "inactive" | "offline" | "stale";
type Fix = { latitude: number; longitude: number; accuracy: number | null; heading: number | null; capturedAt?: string };
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

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let watch: number | null = null;
    let heartbeat = 0;
    let wakeLock: WakeLockSentinel | null = null;
    let last: { fix: Fix; at: number } | null = null;
    let pending: Fix | null = null;
    let latest: Fix | null = null;
    let acquiredAt = 0;
    let inFlight = false;
    let starting = false;
    let permissionDenied = false;
    let lastStart = 0;
    const controller = new AbortController();
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
    async function send(fix: Fix) {
      if (stopped || !fix.capturedAt || Date.now() - Date.parse(fix.capturedAt) > 60_000) return;
      if (!navigator.onLine) { update("offline"); return; }
      if (inFlight) { pending = fix; return; }
      inFlight = true;
      try {
        const response = await fetch("/api/driver/location", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fix), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (stopped) return;
        if (!response.ok) throw new Error("Location rejected");
        const result = await response.json() as { accepted?: boolean; recordedAt?: string; returningToHub?: boolean };
        if (result.accepted === false) {
          last = { fix, at: Date.now() };
          if (result.recordedAt) update(Date.now() - Date.parse(result.recordedAt) <= 60_000 ? "sharing" : "stale", new Date(result.recordedAt), fix, result.returningToHub);
          else update("stale", undefined, fix, result.returningToHub);
          return;
        }
        last = { fix, at: Date.now() };
        update("sharing", result.recordedAt ? new Date(result.recordedAt) : new Date(fix.capturedAt), fix, result.returningToHub);
      } catch {
        if (!stopped) update("error", undefined, fix);
      } finally {
        inFlight = false;
        const queued = pending;
        pending = null;
        if (queued && !stopped) void send(queued);
      }
    }

    function onPosition(position: GeolocationPosition) {
      if (stopped) return;
      if (Date.now() - position.timestamp > 60_000 || position.timestamp > Date.now() + 5_000) { update("stale"); return; }
      const fix = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        heading: Number.isFinite(position.coords.heading) && position.coords.heading !== null ? position.coords.heading : null,
        capturedAt: new Date(position.timestamp).toISOString(),
      };
      latest = fix;
      acquiredAt = position.timestamp;
      setDetectedAt(new Date(position.timestamp));
      setState((current) => ({ ...current, bookingId, attempt, point: fix }));
      const previous = last;
      const elapsed = previous ? Date.now() - previous.at : Infinity;
      if (!previous || elapsed >= minIntervalMs || elapsed >= 2_000 && distanceMeters(previous.fix, fix) >= minMoveMeters) void send(fix);
    }

    function onError(error: GeolocationPositionError) {
      if (stopped) return;
      permissionDenied = error.code === error.PERMISSION_DENIED;
      update(error.code === error.PERMISSION_DENIED ? "denied" : error.code === error.TIMEOUT ? "timeout" : "unavailable");
    }

    async function keepAwake() {
      try {
        if (document.visibilityState === "visible" && "wakeLock" in navigator && !stopped && (!wakeLock || wakeLock.released)) {
          const acquired = await navigator.wakeLock.request("screen");
          if (stopped) await acquired.release();
          else wakeLock = acquired;
        }
      } catch { /* Screen wake lock is optional and may be denied by the OS. */ }
    }

    async function start() {
      if (stopped || starting || document.visibilityState !== "visible") return;
      if (!navigator.onLine) { update("offline"); return; }
      starting = true;
      lastStart = Date.now();
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      watch = null;
      latest = null;
      pending = null;
      acquiredAt = 0;
      update("starting");
      try {
        const response = await fetch("/api/driver/location", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (!response.ok) throw new Error("Location sharing status unavailable");
        const data = await response.json() as { enabled: boolean; returningToHub: boolean; hubs: Hub[]; location: (Fix & { recordedAt: string }) | null; vehicle: Vehicle | null };
        if (stopped) return;
        const recentLocation = data.location && Date.now() - new Date(data.location.recordedAt).getTime() <= 120_000 ? data.location : null;
        update(data.enabled ? "starting" : "inactive", recentLocation ? new Date(recentLocation.recordedAt) : undefined, recentLocation ?? undefined, data.returningToHub, data.hubs, data.vehicle);
        if (!data.enabled) return;
        permissionDenied = false;
        watch = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
        void keepAwake();
      } catch {
        if (!stopped) update("error");
      } finally { starting = false; }
    }
    function resume() {
      if (document.visibilityState === "visible") void start();
    }
    function offline() { update("offline"); }
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", offline);
    window.addEventListener("pageshow", resume);
    heartbeat = window.setInterval(() => {
      if (!navigator.onLine) { update("offline"); return; }
      if (permissionDenied) return;
      const elapsed = last ? Date.now() - last.at : Infinity;
      if (latest && Date.now() - acquiredAt <= 60_000) {
        if (elapsed >= heartbeatMs || latest !== last?.fix && elapsed >= minIntervalMs) void send(latest);
      } else {
        if (acquiredAt) update("stale");
        if (Date.now() - lastStart >= (watch === null ? 15_000 : 60_000)) void start();
      }
    }, 5_000);
    void start();
    return () => {
      stopped = true;
      controller.abort();
      if (watch !== null) navigator.geolocation.clearWatch(watch);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", offline);
      window.removeEventListener("pageshow", resume);
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
