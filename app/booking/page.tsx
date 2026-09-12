"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { HotelSearch } from "@/components/booking/hotel-search";
import { useAuth } from "@/components/auth/auth-provider";

export default function BookingPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const steps = [t("booking.route"), t("booking.details"), t("booking.flightNumber"), t("booking.review")];
  const [step, setStep] = useState(0);
  const [passengers, setPassengers] = useState(2);
  const [hotel, setHotel] = useState("");
  const [direction, setDirection] = useState<"airport-to-city" | "city-to-airport">("airport-to-city");
  const [pickupDate, setPickupDate] = useState("2026-09-15");
  const [pickupTime, setPickupTime] = useState("14:30");
  const [tripType, setTripType] = useState("private-transfer");
  const [submitted, setSubmitted] = useState(false);

  function continueBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((currentStep) => currentStep + 1);
      return;
    }
    setSubmitted(true);
  }

  const isAirportToCity = direction === "airport-to-city";

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      {!user || user.role !== "customer" ? (
        <section className="mx-auto max-w-2xl rounded-[32px] border border-[var(--color-accent)]/30 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{t("booking.accountRequired")}</p>
          <h1 className="mt-3 text-3xl font-black text-[var(--color-text)]">{t("booking.accountTitle")}</h1>
          <p className="mt-4 leading-7 text-slate-600">{t("booking.accountText")}</p>
          <Link href="/auth" className="mt-6 inline-flex rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">{t("booking.registerSignIn")}</Link>
        </section>
      ) : (
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="rounded-[32px] border border-black/5 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{t("booking.titleEyebrow")}</p>
              <h1 className="mt-3 text-4xl font-black tracking-[-0.05em] text-[var(--color-text)]">{t("booking.title")}</h1>
            </div>
            <div className="rounded-2xl bg-[var(--color-background)] px-4 py-3 text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t("booking.fixedPrice")}</div>
              <div className="mt-1 text-2xl font-black text-[var(--color-primary)]">$35</div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-4 gap-2" aria-label="Booking progress">
            {steps.map((label, index) => (
              <div key={label} className="flex items-center gap-2 text-sm font-semibold">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${index <= step ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-400"}`}>
                  {index + 1}
                </span>
                <span className={index <= step ? "text-[var(--color-text)]" : "text-slate-400"}>{label}</span>
              </div>
            ))}
          </div>

          {submitted ? (
            <div className="mt-10 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">{t("booking.requestReceived")}</div>
              <h2 className="mt-3 text-2xl font-black text-[var(--color-text)]">{t("booking.nearlyConfirmed")}</h2>
              <p className="mt-3 text-slate-600">{t("booking.savedRequest")}</p>
              <Link href="/booking/track" className="mt-6 inline-flex rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">{t("booking.trackBooking")}</Link>
            </div>
          ) : (
            <form onSubmit={continueBooking} className="mt-10 space-y-6">
              {step === 0 && (
                <div className="space-y-5">
                  <div>
                    <HotelSearch value={hotel} onChange={setHotel} label={isAirportToCity ? t("booking.cityAddress") : t("booking.destinationLabel")} placeholder={isAirportToCity ? t("booking.destinationPlaceholder") : t("booking.cityAddress")} />
                  </div>
                  <button type="button" onClick={() => setDirection((current) => current === "airport-to-city" ? "city-to-airport" : "airport-to-city")} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10" aria-label={t("booking.swapRoute")}>
                    <span aria-hidden="true" className="text-lg leading-none">⇄</span>{t("booking.swapRoute")}
                  </button>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="date" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.pickupDate")}</label>
                      <input id="date" type="date" value={pickupDate} onChange={(event) => setPickupDate(event.target.value)} required className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                    <div>
                      <label htmlFor="time" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.pickupTime")}</label>
                      <input id="time" type="time" value={pickupTime} onChange={(event) => setPickupTime(event.target.value)} required className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="name" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.leadPassenger")}</label>
                    <input id="name" required placeholder={t("booking.fullName")} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.email")}</label>
                      <input id="email" type="email" required placeholder="you@example.com" className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                    <div>
                      <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.phone")}</label>
                      <input id="phone" type="tel" required placeholder="+855 ..." className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="luggage" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.luggageCount")}</label>
                      <input id="luggage" type="number" min="0" max="20" defaultValue="2" className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                    <div>
                      <label htmlFor="special-needs" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.specialNeeds")}</label>
                      <input id="special-needs" placeholder={t("booking.specialNeedsPlaceholder")} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="flight-number" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.flightNumber")}</label>
                    <input id="flight-number" placeholder={t("booking.flightPlaceholder")} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    <p className="mt-2 text-xs text-slate-500">{t("booking.flightHelp")}</p>
                  </div>
                  <div>
                    <label htmlFor="pickup-notes" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.notes")}</label>
                    <textarea id="pickup-notes" rows={3} placeholder={t("booking.notesPlaceholder")} className="w-full resize-none rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="rounded-3xl bg-[var(--color-background)] p-5 text-sm text-slate-600">
                  <h2 className="mb-5 text-lg font-bold text-[var(--color-text)]">{t("booking.reviewDetails")}</h2>
                  <div className="flex justify-between gap-4"><span>{t("booking.hotel")}</span><strong className="text-right text-[var(--color-text)]">{hotel}</strong></div>
                  <div className="flex justify-between gap-4"><span>{t("booking.route")}</span><strong className="text-right text-[var(--color-text)]">{isAirportToCity ? `${t("booking.airport")} → ${hotel}` : `${hotel} → ${t("booking.airport")}`}</strong></div>
                  <div className="mt-4 flex justify-between gap-4"><span>{t("booking.pickup")}</span><strong className="text-[var(--color-text)]">{pickupDate} · {pickupTime}</strong></div>
                  <div className="mt-4 flex justify-between gap-4"><span>{t("booking.passengers")}</span><strong className="text-[var(--color-text)]">{passengers}</strong></div>
                  <div className="mt-4 flex justify-between gap-4"><span>{t("booking.tripType")}</span><strong className="text-[var(--color-text)]">{tripType === "airport-transfer" ? t("booking.airportTransfer") : tripType === "hotel-transfer" ? t("booking.hotelTransfer") : t("booking.privateTransfer")}</strong></div>
                  <div className="mt-4 flex justify-between gap-4"><span>{t("booking.contactDetails")}</span><strong className="text-right text-[var(--color-text)]">{t("booking.passengerProvided")}</strong></div>
                  <div className="mt-4 flex justify-between gap-4 border-t border-black/10 pt-4"><span>Total</span><strong className="text-xl text-[var(--color-primary)]">$35</strong></div>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
                <button type="button" onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))} disabled={step === 0} className="rounded-full px-4 py-3 text-sm font-semibold text-slate-500 disabled:invisible">{t("booking.back")}</button>
                <Button type="submit">{step === steps.length - 1 ? t("booking.requestTransfer") : t("booking.continue")}</Button>
              </div>
            </form>
          )}
        </section>

        <aside className="h-fit rounded-[28px] bg-[var(--color-primary-dark)] p-6 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{t("booking.tripDetails")}</p>
          <div className="mt-6 space-y-4 text-sm">
            <div className="border-b border-white/10 pb-4"><div className="text-white/60">{t("booking.from")}</div><div className="mt-1 font-semibold">{isAirportToCity ? t("booking.airport") : hotel || t("booking.cityAddress")}</div></div>
            <div className="border-b border-white/10 pb-4"><div className="text-white/60">{t("booking.to")}</div><div className="mt-1 font-semibold">{isAirportToCity ? hotel || t("booking.cityAddress") : t("booking.airport")}</div></div>
            <div className="border-b border-white/10 pb-4"><div className="text-white/60">{t("booking.tripType")}</div><select value={tripType} onChange={(event) => setTripType(event.target.value)} className="mt-1 w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 font-semibold text-white outline-none"><option value="private-transfer" className="text-[var(--color-text)]">{t("booking.privateTransfer")}</option><option value="airport-transfer" className="text-[var(--color-text)]">{t("booking.airportTransfer")}</option><option value="hotel-transfer" className="text-[var(--color-text)]">{t("booking.hotelTransfer")}</option></select><div className="mt-2 text-sm text-white/70">{t("booking.vehicle")} · Toyota Alphard</div></div>
            <div><div className="text-white/60">{t("booking.passengers")}</div><div className="mt-2 flex items-center justify-between"><span className="font-semibold">{t("booking.adults")}</span><div className="flex items-center gap-3"><button type="button" aria-label="Remove passenger" onClick={() => setPassengers((count) => Math.max(1, count - 1))} className="h-8 w-8 rounded-full border border-white/30">−</button><span>{passengers}</span><button type="button" aria-label="Add passenger" onClick={() => setPassengers((count) => Math.min(8, count + 1))} className="h-8 w-8 rounded-full border border-white/30">+</button></div></div></div>
          </div>
          <div className="mt-8 rounded-2xl bg-white/10 p-4 text-sm text-white/80">{t("booking.waiting")}</div>
        </aside>
      </div>
      )}
    </div>
  );
}
