"use client";

import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { PickupLocation } from "@/components/booking/pickup-location";
import { HotelSearch } from "@/components/booking/hotel-search";
import { useLanguage } from "@/components/i18n/language-provider";

export function WalkupTrip({ onStarted, disabled }: { onStarted: () => void; disabled: boolean }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [vehicles, setVehicles] = useState<{ id: string; name: string; plate: string }[]>([]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    void fetch("/api/driver/bookings?walkupOptions=true", { signal: controller.signal, cache: "no-store" }).then(async (r) => {
      if (!r.ok) throw new Error("Vehicles unavailable");
      setVehicles(z.object({ vehicles: z.array(z.object({ id: z.string(), name: z.string(), plate: z.string() })) }).parse(await r.json()).vehicles);
    }).catch(() => { if (!controller.signal.aborted) setError(true); });
    return () => controller.abort();
  }, [open]);
  async function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || disabled) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setError(false);
    try {
      const response = await fetch("/api/driver/bookings", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail: String(form.get("email")), vehicleId: String(form.get("vehicle")), fromAddress: from, toAddress: to, passengers: Number(form.get("passengers")), tripType: "CITY_TRANSFER", direction: "AIRPORT_TO_CITY" }),
      });
      if (!response.ok) throw new Error("Unable to start metered trip");
      setOpen(false); setFrom(""); setTo(""); onStarted();
    } catch { setError(true); } finally { setPending(false); }
  }
  return <section className="my-4 rounded-2xl border bg-white p-4">
    <button type="button" disabled={disabled || pending} onClick={() => setOpen(!open)} className="font-semibold text-[var(--color-primary)]">{t("fare.walkup")}</button>
    {open && <form onSubmit={start} className="mt-4 space-y-3"><fieldset disabled={pending || disabled} className="space-y-3">
      <p className="text-sm">{t("fare.walkupHelp")}</p>
      <label className="block text-sm">{t("booking.email")}<input name="email" required type="email" className="mt-1 w-full rounded-xl border p-3" /></label>
      <label className="block text-sm">{t("booking.vehicle")}<select name="vehicle" required className="mt-1 w-full rounded-xl border p-3"><option value="">—</option>{vehicles.map((v) => <option key={v.id} value={v.id}>{v.name} · {v.plate}</option>)}</select></label>
      <label className="block text-sm">{t("booking.passengers")}<input name="passengers" type="number" required min="1" max="50" defaultValue="1" className="mt-1 w-full rounded-xl border p-3" /></label>
      <PickupLocation value={from} onChange={setFrom} /><HotelSearch value={to} onChange={setTo} label={t("booking.to")} />
      <button type="submit" className="rounded-xl bg-[var(--color-primary)] p-3 text-white">{t("driver.start")}</button>
    </fieldset></form>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{t("fare.walkupError")}</p>}
  </section>;
}
