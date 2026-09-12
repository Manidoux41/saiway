"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { HotelSearch } from "@/components/booking/hotel-search";

export function BookingWidget() {
  const { t } = useLanguage();
  const router = useRouter();
  const [airportToCity, setAirportToCity] = useState(true);
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("2026-09-15");
  const [time, setTime] = useState("14:30");
  const [tripType, setTripType] = useState("private-transfer");

  function checkPrice() {
    const params = new URLSearchParams({
      direction: airportToCity ? "airport-to-city" : "city-to-airport",
      destination,
      date,
      time,
      tripType,
    });
    router.push(`/booking?${params.toString()}`);
  }

  return (
    <section className="mx-auto w-full max-w-5xl rounded-[32px] border border-black/5 bg-white p-4 shadow-[0_18px_60px_rgba(23,34,31,0.08)] md:p-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
            {t("booking.widgetEyebrow")}
          </p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--color-text)] md:text-3xl">
            {t("home.title")}
          </h2>
        </div>
        <div className="rounded-full border border-[var(--color-primary)]/15 bg-[var(--color-primary)]/5 px-3 py-1.5 text-xs font-medium text-[var(--color-primary)]">
          {t("booking.trusted")}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.2fr_1.2fr_0.8fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-[var(--color-input)] p-4">
          {airportToCity ? <><label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t("booking.from")}</label><div className="flex items-center gap-3 text-base font-medium text-[var(--color-text)]"><span aria-hidden="true">✈</span><span>{t("booking.airport")}</span></div></> : <HotelSearch value={destination} onChange={setDestination} label={t("booking.from")} placeholder={t("booking.cityAddress")} />}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[var(--color-input)] p-4">
          {airportToCity ? <HotelSearch value={destination} onChange={setDestination} label={t("booking.to")} placeholder={t("booking.searchDestination")} /> : <><label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t("booking.to")}</label><div className="flex items-center gap-3 text-base font-medium text-[var(--color-text)]"><span aria-hidden="true">✈</span><span>{t("booking.airport")}</span></div></>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-[var(--color-input)] p-4">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t("booking.date")}
          </label>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="w-full bg-transparent text-base font-semibold text-[var(--color-text)] outline-none" aria-label={t("booking.date")} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[var(--color-input)] p-4">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t("booking.time")}
          </label>
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="w-full bg-transparent text-base font-semibold text-[var(--color-text)] outline-none" aria-label={t("booking.time")} />
        </div>
      </div>

      <button type="button" onClick={() => setAirportToCity((current) => !current)} className="mt-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10" aria-label={t("booking.swapRoute")}>
        <span aria-hidden="true" className="text-lg leading-none">⇄</span>{t("booking.swapRoute")}
      </button>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <div className="rounded-2xl border border-slate-200 bg-[var(--color-input)] p-4">
          <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t("booking.passengers")}
          </label>
          <div className="flex items-center justify-between text-base font-semibold text-[var(--color-text)]">
            <button className="rounded-full border border-slate-300 px-2.5 py-1 text-lg leading-none">−</button>
            <span>2</span>
            <button className="rounded-full border border-slate-300 px-2.5 py-1 text-lg leading-none">+</button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-[var(--color-input)] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {t("booking.tripType")}
          </div>
          <select value={tripType} onChange={(event) => setTripType(event.target.value)} className="mt-2 w-full bg-transparent text-base font-semibold text-[var(--color-text)] outline-none"><option value="private-transfer">{t("booking.privateTransfer")}</option><option value="airport-transfer">{t("booking.airportTransfer")}</option><option value="hotel-transfer">{t("booking.hotelTransfer")}</option></select>
        </div>

        <Button type="button" onClick={checkPrice} className="h-[74px] min-w-[220px] text-base">{t("booking.checkPrice")}</Button>
      </div>
    </section>
  );
}
