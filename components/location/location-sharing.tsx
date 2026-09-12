"use client";

import { useEffect, useState } from "react";

export function LocationSharing({ mode }: { mode: "customer" | "driver" }) {
  const [sharing, setSharing] = useState(false);
  const [coordinates, setCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [error, setError] = useState("");
  const browserSupportsLocation = typeof navigator !== "undefined" && Boolean(navigator.geolocation);

  useEffect(() => {
    if (!sharing || !browserSupportsLocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoordinates({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setError("");
      },
      () => setError("Location permission was denied or unavailable."),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [browserSupportsLocation, sharing]);

  function toggleSharing() {
    setError("");
    setSharing((current) => !current);
  }

  return (
    <section className="mt-8 rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Live location</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">{mode === "driver" ? "Share your location with the customer" : "Share your location with your driver"}</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">Your position is shared only while this switch is active. A production connection should send these coordinates to the authenticated booking channel.</p>
        </div>
        <button type="button" onClick={toggleSharing} className={`shrink-0 rounded-full px-5 py-3 text-sm font-semibold transition ${sharing ? "bg-[var(--color-error)] text-white" : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-dark)]"}`}>
          {sharing ? "Stop sharing" : "Share my location"}
        </button>
      </div>
      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className={`h-2.5 w-2.5 rounded-full ${sharing ? "animate-pulse bg-emerald-500" : "bg-slate-300"}`} />
        <span className="text-slate-600">{sharing ? "Location sharing is active" : "Location sharing is off"}</span>
      </div>
      {coordinates && sharing && <p className="mt-3 font-mono text-xs text-slate-500">{coordinates.latitude.toFixed(5)}, {coordinates.longitude.toFixed(5)}</p>}
      {(error || !browserSupportsLocation) && <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{error || "Location is not supported by this browser."}</p>}
    </section>
  );
}
