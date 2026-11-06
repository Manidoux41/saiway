"use client";

import { useRef, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { HotelSearch } from "@/components/booking/hotel-search";
import { useLanguage } from "@/components/i18n/language-provider";
import { coordinateAddress, parseCoordinateAddress, validLocationPoint, type LocationPoint } from "@/lib/booking-location";

const PickerMap = dynamic(() => import("./location-picker-map"), { ssr: false });
type LocationMessage = "" | "places.gpsUnavailable" | "places.gpsDenied" | "places.copied" | "places.shareError" | "places.invalidGps";

export function PickupLocation({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLanguage();
  const [mapOpen, setMapOpen] = useState(false);
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<LocationMessage>("");
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const point = parseCoordinateAddress(value);
  function choose(point: LocationPoint) {
    onChange(coordinateAddress(point)); setLatitude(String(point.latitude)); setLongitude(String(point.longitude)); setMessage("");
  }
  function locate() {
    if (!navigator.geolocation) { setMessage("places.gpsUnavailable"); return; }
    setBusy(true); setMessage("");
    navigator.geolocation.getCurrentPosition((position) => {
      if (!mounted.current) return;
      choose({ latitude: position.coords.latitude, longitude: position.coords.longitude }); setBusy(false);
    }, (error) => {
      if (!mounted.current) return;
      setBusy(false); setMessage(error.code === 1 ? "places.gpsDenied" : "places.gpsUnavailable");
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  }
  async function share() {
    if (!point) return;
    const text = `${coordinateAddress(point)}\nhttps://www.openstreetmap.org/?mlat=${point.latitude}&mlon=${point.longitude}#map=17/${point.latitude}/${point.longitude}`;
    try {
      if (navigator.share) await navigator.share({ title: t("booking.from"), text });
      else { await navigator.clipboard.writeText(text); setMessage("places.copied"); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("places.shareError");
    }
  }
  const button = "rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold";
  return <div className="space-y-3">
    <HotelSearch value={value} onChange={onChange} label={t("booking.from")} placeholder={t("places.pickupPlaceholder")} />
    <p className="text-xs text-slate-500">{t("places.gpsConsent")}</p>
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={locate} className={button}>{t(busy ? "places.locating" : "places.useGps")}</button>
      <button type="button" onClick={() => setMapOpen(!mapOpen)} aria-expanded={mapOpen} className={button}>{t("places.pickMap")}</button>
      {point && <button type="button" onClick={() => void share()} className={button}>{t("places.share")}</button>}
    </div>
    <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm font-semibold">{t("places.coordinates")}</summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">{t("fleet.latitude")}<input type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} className="mt-1 w-full rounded-xl border p-2" /></label>
        <label className="text-sm">{t("fleet.longitude")}<input type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} className="mt-1 w-full rounded-xl border p-2" /></label>
      </div>
      <button type="button" className={`${button} mt-3`} onClick={() => {
        const point = { latitude: Number(latitude), longitude: Number(longitude) };
        if (!latitude.trim() || !longitude.trim() || !validLocationPoint(point)) { setMessage("places.invalidGps"); return; }
        choose(point);
      }}>{t("places.applyCoordinates")}</button>
    </details>
    {mapOpen && <><p className="text-xs text-slate-500">{t("places.mapHelp")}</p><PickerMap point={point} onSelect={choose} /></>}
    {message && <p role="status" className="text-sm text-slate-700">{t(message)}</p>}
  </div>;
}
