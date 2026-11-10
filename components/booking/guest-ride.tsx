"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { LocateFixed } from "lucide-react";
import { useLanguage, type TranslationKey } from "@/components/i18n/language-provider";
import { coordinateAddress } from "@/lib/booking-location";
import { freshGuestGps, guestCancellableStatuses, guestClosedStatuses, guestGpsSchema, guestRideViewSchema, type GuestRideView } from "@/lib/guest-ride-policy";
import { enumLabel } from "@/components/i18n/enum-label";

const responseSchema = z.object({ booking: guestRideViewSchema.nullable() });
const button = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-blue-900 disabled:opacity-50";
const action = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-4 py-3 text-sm font-bold text-white disabled:opacity-50";
function errorKey(status: number): TranslationKey {
  return status === 429 ? "guest.limit" : status === 401 ? "guest.cookies" : status === 409 ? "guest.conflict" : status === 400 ? "guest.gps" : "guest.error";
}

export function GuestRide() {
  const { t, language } = useLanguage();
  const [ride, setRide] = useState<GuestRideView | null>(null);
  const [gps, setGps] = useState<z.infer<typeof guestGpsSchema> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [mutationError, setMutationError] = useState<TranslationKey | null>(null);
  const [gpsError, setGpsError] = useState(false);
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController();
    let loading = false;
    async function read(initialize = false) {
      if (lock.current || loading) return;
      loading = true;
      try {
        if (initialize) {
          const session = await fetch("/api/guest-rides/session", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
          if (!session.ok) { setError(errorKey(session.status)); return; }
        }
        const response = await fetch("/api/guest-rides", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) { setError(errorKey(response.status)); setLoaded(false); return; }
        const result = responseSchema.parse(await response.json());
        if (!controller.signal.aborted && !lock.current) { setRide(result.booking); setLoaded(true); setError(null); setNow(Date.now()); }
      } catch {
        if (!controller.signal.aborted) { setError("guest.error"); setLoaded(false); }
      } finally { loading = false; }
    }
    void read(true);
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void read(); }, 5000);
    const visible = () => { if (document.visibilityState === "visible") void read(); };
    document.addEventListener("visibilitychange", visible);
    return () => { mounted.current = false; controller.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, [revision]);
  function locate() {
    if (lock.current) return;
    if (!navigator.geolocation) { setGpsError(true); return; }
    lock.current = true; setPending(true); setGpsError(false); setGps(null);
    navigator.geolocation.getCurrentPosition((position) => {
      if (!mounted.current) return;
      const parsed = guestGpsSchema.safeParse({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date(position.timestamp).toISOString() });
      if (parsed.success && freshGuestGps(parsed.data.capturedAt)) setGps(parsed.data);
      else setGpsError(true);
      lock.current = false; setPending(false);
    }, () => {
      if (!mounted.current) return;
      setGpsError(true); lock.current = false; setPending(false);
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
  }
  async function mutate(method: "POST" | "DELETE", reset = false) {
    if (lock.current) return;
    if (method === "POST" && !reset && (!gps || !freshGuestGps(gps.capturedAt))) { setGpsError(true); setGps(null); return; }
    lock.current = true; setPending(true); setMutationError(null);
    try {
      const response = await fetch(reset ? "/api/guest-rides/session" : "/api/guest-rides", { method, headers: { "Content-Type": "application/json" }, body: method === "POST" && !reset ? JSON.stringify(gps) : undefined, signal: AbortSignal.timeout(20000) });
      if (!response.ok) { setMutationError(errorKey(response.status)); return; }
      if (reset) { setRide(null); setGps(null); setLoaded(true); }
      else { setRide(responseSchema.parse(await response.json()).booking); setGps(null); }
    } catch { setMutationError("guest.error"); }
    finally { lock.current = false; setPending(false); setRevision((value) => value + 1); }
  }
  const closed = ride && guestClosedStatuses.includes(ride.status);
  const stale = ride?.location && now - Date.parse(ride.location.recordedAt) > 120000;
  return <section className="mx-auto w-full max-w-3xl space-y-5 rounded-3xl border border-blue-100 bg-white p-5 shadow-sm sm:p-8">
    <h1 className="text-2xl font-black text-[var(--color-primary)] sm:text-3xl">{t("guest.title")}</h1>
    <p className="leading-7 text-slate-700">{t("guest.help")}</p>
    <p className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-950">{t("guest.privacy")}</p>
    {error && <p role="alert" className="text-red-700">{t(error)}</p>}
    {mutationError && <p role="alert" className="text-red-700">{t(mutationError)}</p>}
    {(!loaded || error) && <button type="button" className={button} disabled={pending} onClick={() => setRevision((value) => value + 1)}>{t("guest.refresh")}</button>}
    {!loaded && !error && <p role="status">{t("admin.loading")}</p>}
    {ride ? <div className="space-y-4" aria-live="polite">
      <h2 className="text-lg font-bold">{t("guest.reference")}</h2><p className="break-all rounded-xl bg-slate-100 p-4 font-mono text-lg font-bold">{ride.reference}</p>
      <p className="font-bold">{enumLabel(ride.status, t)}</p>
      <p className="break-words text-sm">{t("booking.from")}: {ride.fromAddress}</p>
      <p className="text-sm leading-6">{t(closed ? "guest.closed" : ride.status === "TRIP_STARTED" ? "guest.ongoing" : "guest.meet")}</p>
      {ride.driverName && <p>{t("admin.driver")}: <strong>{ride.driverName}</strong></p>}
      {ride.vehicle && <p>{t("booking.vehicle")}: {ride.vehicle.name} · <strong>{ride.vehicle.plate}</strong></p>}
      {ride.toAddress && <p className="break-words">{t("booking.to")}: {ride.toAddress}</p>}
      <p className="font-bold">{ride.priceCents === null ? t("guest.price") : new Intl.NumberFormat(language, { style: "currency", currency: ride.currency }).format(ride.priceCents / 100)}</p>
      {ride.location && <div className="space-y-2 rounded-xl border p-4">
        <p>{t("guest.location")}: {coordinateAddress(ride.location)}</p>
        <p className="text-sm">{new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Phnom_Penh" }).format(new Date(ride.location.recordedAt))}</p>
        {stale && <p role="status" className="text-amber-800">{t("guest.stale")}</p>}
        <a className="inline-block py-2 font-semibold text-blue-800 underline" href={`https://www.openstreetmap.org/?mlat=${ride.location.latitude}&mlon=${ride.location.longitude}#map=17/${ride.location.latitude}/${ride.location.longitude}`} target="_blank" rel="noopener noreferrer">{t("driver.map")}</a>
      </div>}
      <div className="flex flex-wrap gap-3"><button type="button" className={button} disabled={pending} onClick={() => setRevision((value) => value + 1)}>{t("guest.refresh")}</button>
        {guestCancellableStatuses.includes(ride.status) && <button type="button" className={button} disabled={pending} onClick={() => void mutate("DELETE")}>{t("guest.cancel")}</button>}
        {closed && <button type="button" className={action} disabled={pending} onClick={() => void mutate("POST", true)}>{t("guest.new")}</button>}
      </div>
    </div> : loaded && !error && <div className="space-y-4">
      <button type="button" className={button} disabled={pending} onClick={locate}><LocateFixed size={18} aria-hidden="true" />{t(pending ? "places.locating" : "guest.locate")}</button>
      {gpsError && <p role="alert" className="text-red-700">{t("guest.gps")}</p>}
      {gps && <div className="space-y-3"><p className="break-words text-sm">{coordinateAddress(gps)} · {t("guest.accuracy")}: {Math.ceil(gps.accuracy)} m</p><p className="text-sm font-bold">{t("guest.price")}</p><button type="button" className={action} disabled={pending} onClick={() => void mutate("POST")}>{t(pending ? "admin.saving" : "guest.send")}</button></div>}
    </div>}
  </section>;
}
