"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useLanguage } from "@/components/i18n/language-provider";
import { courseSchema, type Course } from "@/components/booking/course-dashboard";

const meterSchema = z.object({ distanceMeters: z.number(), priceCents: z.number().int(), complete: z.boolean(), mode: z.enum(["CITY", "AIRPORT"]) });

export function GuestMeter({ course, disabled, onPending, onSaved }: { course: Course; disabled: boolean; onPending: (pending: boolean) => void; onSaved: (course: Course) => void }) {
  const { t, language } = useLanguage();
  const [meter, setMeter] = useState<z.infer<typeof meterSchema> | null>(null);
  const [error, setError] = useState("");
  const [price, setPrice] = useState((course.priceCents / 100).toFixed(2));
  const lock = useRef(false);
  const money = (cents: number) => new Intl.NumberFormat(language, { style: "currency", currency: course.currency }).format(cents / 100);
  useEffect(() => {
    if (course.status !== "TRIP_STARTED") return;
    const controller = new AbortController();
    let reading = false;
    async function read() {
      if (reading || document.visibilityState !== "visible") return;
      reading = true;
      try {
        const response = await fetch(`/api/driver/bookings?meter=${encodeURIComponent(course.id)}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (!response.ok) throw new Error("Meter unavailable");
        const value = meterSchema.parse(await response.json());
        if (!controller.signal.aborted) { setMeter(value); setError(""); }
      } catch {
        if (!controller.signal.aborted) { setMeter(null); setError(t("guest.meterError")); }
      } finally { reading = false; }
    }
    void read();
    const timer = window.setInterval(() => void read(), 5000);
    document.addEventListener("visibilitychange", read);
    return () => { controller.abort(); window.clearInterval(timer); document.removeEventListener("visibilitychange", read); };
  }, [course.id, course.status, t]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled || course.status !== "TRIP_COMPLETED") return;
    const amount = Math.round(Number(price) * 100);
    if (!/^\d+(?:\.\d{1,2})?$/.test(price) || !Number.isSafeInteger(amount) || amount > 10000000 || course.fareDetails?.mode === "AIRPORT" && amount > 3000) { setError(t("guest.priceInvalid")); return; }
    lock.current = true; onPending(true); setError("");
    try {
      const response = await fetch("/api/driver/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: course.id, finalPriceCents: amount, expectedPriceCents: course.priceCents }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error("Fare correction rejected");
      onSaved(z.object({ booking: courseSchema }).parse(await response.json()).booking);
    } catch { setError(t("guest.priceError")); }
    finally { lock.current = false; onPending(false); }
  }
  const paid = course.payments?.some((payment) => ["PAID", "PROCESSING"].includes(payment.status));
  return <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-label={t("guest.meterTitle")}>
    <h4 className="font-bold text-blue-950">{t("guest.meterTitle")}</h4>
    {course.status === "TRIP_STARTED" ? <>
      <p className="text-sm">{t("guest.meterHelp")}</p>
      {meter && <p className="text-xl font-black tabular-nums">{new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format(meter.distanceMeters / 1000)} km · {money(meter.priceCents)}</p>}
      {meter && !meter.complete && <p role="status" className="text-sm text-amber-900">{t("guest.meterGap")}</p>}
    </> : <p className="font-bold">{money(course.priceCents)} · {new Intl.NumberFormat(language, { maximumFractionDigits: 2 }).format((course.fareDetails?.distanceMeters ?? 0) / 1000)} km</p>}
    {course.status === "TRIP_COMPLETED" && !paid && <form onSubmit={save} className="space-y-3">
      <label className="block text-sm font-semibold">{t("guest.editPrice")} (USD)<input type="number" min="0" max={course.fareDetails?.mode === "AIRPORT" ? 30 : 100000} step="0.01" required value={price} disabled={disabled} onChange={(event) => setPrice(event.target.value)} className="mt-2 w-full rounded-xl border bg-white p-3" /></label>
      <p className="text-sm">{t("guest.priceAudit")}</p>
      <button type="submit" disabled={disabled} className="min-h-12 rounded-xl bg-blue-900 px-4 py-3 font-bold text-white disabled:opacity-50">{t("guest.savePrice")}</button>
    </form>}
    {error && <p role="alert" className="text-red-700">{error}</p>}
  </section>;
}
