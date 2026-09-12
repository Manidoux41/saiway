"use client";

import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { DriverMessage } from "@/components/booking/driver-message";
import { LocationSharing } from "@/components/location/location-sharing";

export default function TrackingPage() {
  const { t } = useLanguage();
  const [reference, setReference] = useState("");
  const [trackedReference, setTrackedReference] = useState("SW-240915");

  function trackBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTrackedReference(reference.trim().toUpperCase() || "SW-240915");
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-[32px] border border-black/5 bg-white p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{t("track.eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--color-text)]">{t("track.title")}</h1>
        <p className="mt-4 max-w-xl text-slate-600">{t("track.description")}</p>

        <form onSubmit={trackBooking} className="mt-6 flex flex-col gap-3 sm:flex-row">
          <label htmlFor="booking-reference" className="sr-only">Booking reference</label>
          <input id="booking-reference" value={reference} onChange={(event) => setReference(event.target.value)} placeholder={t("track.placeholder")} className="min-w-0 flex-1 rounded-full border border-slate-200 bg-[var(--color-input)] px-5 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10" />
          <button type="submit" className="rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]">{t("track.find")}</button>
        </form>

        <div className="mt-8 rounded-[28px] border border-slate-200 bg-[var(--color-background)] p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-2xl text-white">🚗</div>
            <div>
              <div className="text-xl font-bold text-[var(--color-text)]">Toyota Alphard</div>
              <div className="text-sm text-slate-500">Sokha</div>
            </div>
            </div>
            <div className="text-sm font-semibold text-slate-500">{trackedReference}</div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("track.eta")}</div>
              <div className="mt-2 text-3xl font-black text-[var(--color-primary)]">08 min</div>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("track.status")}</div>
              <div className="mt-2 text-lg font-bold text-[var(--color-text)]">{t("track.enRoute")}</div>
            </div>
          </div>

          <div className="relative mt-6 h-64 overflow-hidden rounded-[24px] border border-slate-200 bg-[#e6eee5]" aria-label="Live driver map">
            <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(35deg,transparent_48%,#ffffff_49%,#ffffff_51%,transparent_52%),linear-gradient(120deg,transparent_48%,#ffffff_49%,#ffffff_51%,transparent_52%)] [background-size:96px_72px]" />
            <div className="absolute left-[27%] top-[58%] h-3 w-3 rounded-full bg-[var(--color-primary)] ring-8 ring-[var(--color-primary)]/15" />
            <div className="absolute right-[22%] top-[25%] h-3 w-3 rounded-full bg-[var(--color-accent)] ring-8 ring-[var(--color-accent)]/20" />
            <div className="absolute bottom-4 left-4 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-[var(--color-text)] shadow-sm">{t("track.mapLabel")}</div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--color-input)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("track.pickup")}</div>
              <div className="mt-2 text-base font-semibold">SAI Airport</div>
            </div>
            <div className="rounded-2xl bg-[var(--color-input)] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{t("track.destination")}</div>
              <div className="mt-2 text-base font-semibold">{t("track.hotel")}</div>
            </div>
          </div>
        </div>

        <DriverMessage bookingReference={trackedReference} />
        <LocationSharing mode="customer" />
      </div>
    </div>
  );
}
