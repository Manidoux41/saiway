"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { HotelSearch } from "@/components/booking/hotel-search";
import { useLanguage } from "@/components/i18n/language-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { coordinateAddress, parseCoordinateAddress, type LocationPoint } from "@/lib/booking-location";
import { reversePlace } from "@/lib/place-search";
import { fareDetailsSchema } from "@/lib/fare-policy";
import { routeDetailsSchema } from "@/lib/route-details";
import { FareSummary } from "@/components/booking/fare-summary";

const RouteMap = dynamic(() => import("@/components/maps/saved-route-map").then((module) => module.SavedRouteMap), { ssr: false });
const previewSchema = z.object({ token: z.string(), priceCents: z.number().nullable(), route: routeDetailsSchema, fareDetails: fareDetailsSchema });
type Preview = z.infer<typeof previewSchema>;

export function WalkupTrip({ onStarted, disabled, location, gpsPhase, retryGps }: {
  onStarted: () => void; disabled: boolean; location: LocationPoint | null; gpsPhase: string; retryGps: () => void;
}) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<{ id: string; name: string; plate: string }[]>([]);
  const [vehicleId, setVehicleId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [fromPoint, setFromPoint] = useState<LocationPoint | undefined>();
  const [toPoint, setToPoint] = useState<LocationPoint | undefined>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [gpsMessage, setGpsMessage] = useState("");
  const [departureEdited, setDepartureEdited] = useState(false);
  const [preview, setPreview] = useState<{ selection: string; value: Preview } | null>(null);
  const [revision, setRevision] = useState(0);
  const manualDeparture = useRef(false);
  const initialized = useRef(false);
  const selection = JSON.stringify({ fromAddress: from, toAddress: to, fromPoint, toPoint, vehicleId });
  const quote = preview?.selection === selection ? preview.value : null;
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/driver/bookings?walkupOptions=true", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(t("auto.error"));
      setVehicles(z.object({ vehicles: z.array(z.object({ id: z.string(), name: z.string(), plate: z.string() })) }).parse(await response.json()).vehicles);
    }).catch(() => { if (!controller.signal.aborted) setError(t("auto.error")); });
    return () => controller.abort();
  }, [open, t]);
  useEffect(() => {
    if (!open || !location || initialized.current || manualDeparture.current) return;
    const controller = new AbortController();
    const point = { latitude: location.latitude, longitude: location.longitude };
    async function locate() {
      await Promise.resolve();
      if (controller.signal.aborted || manualDeparture.current) return;
      initialized.current = true;
      setFromPoint(point); setFrom(coordinateAddress(point));
      try {
        const label = await reversePlace(point, AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]));
        if (!controller.signal.aborted && !manualDeparture.current && label) setFrom(label);
      } catch {
        if (!controller.signal.aborted && !manualDeparture.current) setGpsMessage(t("auto.reverseError"));
      }
    }
    void locate();
    return () => controller.abort();
  }, [open, location, t]);
  useEffect(() => {
    if (!open || !from.trim() || !to.trim() || !vehicleId) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        if (!navigator.onLine) throw new Error(t("auto.offline"));
        const response = await fetch("/api/driver/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.any([controller.signal, AbortSignal.timeout(25000)]), body: JSON.stringify({ action: "preview", selection: JSON.parse(selection) }) });
        if (!response.ok) throw new Error(t("auto.error"));
        const value = previewSchema.parse(await response.json());
        if (!controller.signal.aborted) { setPreview({ selection, value }); setError(""); }
      } catch { if (!controller.signal.aborted) setError(t(navigator.onLine ? "auto.error" : "auto.offline")); }
    }, 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [open, from, to, vehicleId, selection, revision, t]);
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled || !quote) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      if (!navigator.onLine) throw new Error(t("auto.offline"));
      const email = String(form.get("email") ?? "").trim();
      const response = await fetch("/api/driver/bookings", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteToken: quote.token, ...(email ? { customerEmail: email } : {}), passengerName: String(form.get("passenger") ?? ""), contactPhone: String(form.get("phone") ?? ""), passengers: Number(form.get("passengers")),
          ...(quote.fareDetails.mode === "OUTSIDE" ? { agreedPriceCents: Math.round(Number(form.get("agreedPrice")) * 100), priceReason: String(form.get("reason") ?? "") } : {}) }),
      });
      if (!response.ok) {
        const failure = z.object({ error: z.string() }).safeParse(await response.json());
        throw new Error(`${t("auto.error")}${failure.success ? ` ${failure.data.error}` : ""}`);
      }
      setOpen(false); setFrom(""); setTo(""); setFromPoint(undefined); setToPoint(undefined); setGpsMessage(""); setPreview(null); setDepartureEdited(false); initialized.current = false; manualDeparture.current = false; onStarted();
    } catch (failure) { setError(failure instanceof Error ? failure.message : t("auto.error")); } finally { setPending(false); }
  }
  const input = "mt-1 w-full rounded-xl border p-3";
  return <section className="my-4 rounded-2xl border bg-white p-4 sm:p-6">
    <button type="button" disabled={disabled || pending} onClick={() => setOpen(!open)} className="min-h-12 w-full rounded-xl bg-[var(--color-primary)] p-3 text-lg font-bold text-white disabled:opacity-50">{t("auto.new")}</button>
    {open && <form onSubmit={start} className="mt-4 space-y-4"><fieldset disabled={pending || disabled} className="space-y-4">
      <p className="text-sm">{t("auto.review")}</p>
      <strong>{user?.name}</strong>
      {!fromPoint && !departureEdited && <p role="status">{t(gpsPhase === "starting" ? "auto.gps" : "auto.gpsHelp")} <button type="button" onClick={retryGps} className="underline">{t("live.retry")}</button></p>}
      {gpsMessage && <p role="status" className="text-sm text-amber-800">{gpsMessage}</p>}
      <label className="block text-sm">{t("booking.vehicle")}<select value={vehicleId} onChange={(event) => setVehicleId(event.target.value)} required className={input}><option value="">—</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate}</option>)}</select></label>
      <HotelSearch cambodiaOnly value={from} onChange={(value) => { manualDeparture.current = true; setDepartureEdited(true); setFrom(value); setFromPoint(parseCoordinateAddress(value) ?? undefined); }} onSelectPoint={setFromPoint} label={t("booking.from")} />
      {fromPoint && <p className="text-xs text-slate-500">{coordinateAddress(fromPoint)}</p>}
      <HotelSearch cambodiaOnly value={to} onChange={(value) => { setTo(value); setToPoint(parseCoordinateAddress(value) ?? undefined); }} onSelectPoint={setToPoint} label={t("booking.to")} />
      {toPoint && <p className="text-xs text-slate-500">{coordinateAddress(toPoint)}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{t("auto.passenger")}<input name="passenger" maxLength={200} className={input} /></label>
        <label className="text-sm">{t("auto.phone")}<input name="phone" type="tel" maxLength={50} className={input} /></label>
        <label className="text-sm">{t("auto.email")}<input name="email" type="email" className={input} /></label>
        <label className="text-sm">{t("booking.passengers")}<input name="passengers" type="number" required min="1" max="50" defaultValue="1" className={input} /></label>
      </div>
      {!quote && from.trim() && to.trim() && vehicleId && !error && <p role="status">{t("driver.routeLoading")}</p>}
      <button type="button" disabled={!from.trim() || !to.trim() || !vehicleId} className="w-full rounded-xl border p-3 font-semibold" onClick={() => { setPreview(null); setRevision((value) => value + 1); }}>{t("auto.preview")}</button>
      {quote && <div className="space-y-3">
        <RouteMap route={quote.route} />
        <p className="font-semibold">{(quote.route.distanceMeters / 1000).toFixed(2)} km · {Math.ceil(quote.route.durationSeconds / 60)} min</p>
        <p className="text-xl font-bold">{quote.priceCents === null ? t("auto.outside") : `${(quote.priceCents / 100).toFixed(2)} USD`}</p>
        {quote.fareDetails.mode === "OUTSIDE" ? <div className="space-y-3 rounded-xl bg-amber-50 p-4">
          <label className="block">{t("auto.agreed")}<input name="agreedPrice" type="number" required min="0" max="100000" step="0.01" className={input} /></label>
          <label className="block">{t("auto.reason")}<textarea name="reason" required minLength={3} maxLength={2000} className={input} /></label>
        </div> : <FareSummary details={quote.fareDetails} />}
      </div>}
      <button type="submit" disabled={!quote} className="min-h-14 w-full rounded-xl bg-[var(--color-primary)] p-4 font-bold text-white disabled:opacity-40">{t(pending ? "admin.saving" : "auto.confirm")}</button>
    </fieldset></form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </section>;
}
