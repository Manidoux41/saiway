"use client";

import { useEffect, useRef, useState } from "react";

export type SharingPhase = "starting" | "sharing" | "denied" | "unavailable" | "unsupported" | "error";
type Fix = { latitude: number; longitude: number; accuracy: number | null };

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

/** Streams the driver's GPS position to the server while `bookingId` is set; stops as soon as it becomes null. */
export function useLocationSharing(bookingId: string | null) {
  const [state, setState] = useState<{ bookingId: string | null; attempt: number; phase: SharingPhase; lastSent: Date | null }>({ bookingId: null, attempt: 0, phase: "starting", lastSent: null });
  const [attempt, setAttempt] = useState(0);
  const last = useRef<{ fix: Fix; at: number } | null>(null);
  const pending = useRef<Fix | null>(null);
  const latest = useRef<Fix | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    if (!bookingId) return;
    const update = (phase: SharingPhase, lastSent?: Date) => setState((current) => ({ bookingId, attempt, phase, lastSent: lastSent ?? (current.bookingId === bookingId ? current.lastSent : null) }));
    if (!("geolocation" in navigator)) {
      void Promise.resolve().then(() => update("unsupported"));
      return;
    }
    let stopped = false;
    let wakeLock: WakeLockSentinel | null = null;
    last.current = null;
    pending.current = null;
    latest.current = null;

    async function send(fix: Fix) {
      if (inFlight.current) { pending.current = fix; return; }
      inFlight.current = true;
      try {
        const response = await fetch(`/api/driver/bookings/${encodeURIComponent(bookingId!)}/location`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fix), signal: AbortSignal.timeout(15_000) });
        if (stopped) return;
        if (!response.ok) throw new Error("Location rejected");
        last.current = { fix, at: Date.now() };
        update("sharing", new Date());
      } catch {
        if (!stopped) update("error");
      } finally {
        inFlight.current = false;
        const queued = pending.current;
        pending.current = null;
        if (queued && !stopped) void send(queued);
      }
    }

    function onPosition(position: GeolocationPosition) {
      const fix = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null };
      latest.current = fix;
      const previous = last.current;
      const elapsed = previous ? Date.now() - previous.at : Infinity;
      if (!previous || elapsed >= minIntervalMs || elapsed >= 2_000 && distanceMeters(previous.fix, fix) >= minMoveMeters) void send(fix);
    }

    function onError(error: GeolocationPositionError) {
      update(error.code === error.PERMISSION_DENIED ? "denied" : "unavailable");
    }

    async function keepAwake() {
      try { if (document.visibilityState === "visible" && "wakeLock" in navigator && !stopped) wakeLock = await navigator.wakeLock.request("screen"); } catch { /* best effort */ }
    }

    const watch = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
    // watchPosition is silent while the car is stopped, so resend the last fix to show the customer the position is still current.
    const heartbeat = window.setInterval(() => {
      const fix = latest.current;
      const elapsed = last.current ? Date.now() - last.current.at : Infinity;
      if (fix && (elapsed >= heartbeatMs || fix !== last.current?.fix && elapsed >= minIntervalMs)) void send(fix);
    }, 5_000);
    void keepAwake();
    document.addEventListener("visibilitychange", keepAwake);
    return () => {
      stopped = true;
      navigator.geolocation.clearWatch(watch);
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", keepAwake);
      void wakeLock?.release().catch(() => undefined);
    };
  }, [bookingId, attempt]);

  const current = state.bookingId === bookingId && state.attempt === attempt;
  return {
    phase: current ? state.phase : "starting" as SharingPhase,
    lastSent: current ? state.lastSent : null,
    retry: () => setAttempt((value) => value + 1),
  };
}
