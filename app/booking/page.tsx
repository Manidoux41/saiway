"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/i18n/language-provider";
import { HotelSearch } from "@/components/booking/hotel-search";
import { PickupLocation } from "@/components/booking/pickup-location";
import { fareDetailsSchema, type FareDetails } from "@/lib/fare-policy";
import { FareSummary } from "@/components/booking/fare-summary";
import { useAuth } from "@/components/auth/auth-provider";
import { ArrowRight, Check, Compass, CreditCard, Hotel, Plane, Route, ShieldCheck, Users, Wallet } from "lucide-react";

const tripOptions = [
  { value: "airport-transfer", label: "fare.airport", description: "booking.airportChoice", icon: Plane },
  { value: "city-transfer", label: "fare.city", description: "booking.cityChoice", icon: Route },
  { value: "tourist-tour", label: "fare.tour", description: "booking.tourChoice", icon: Compass },
  { value: "private-transfer", label: "booking.privateTransfer", description: "booking.privateChoice", icon: Users },
  { value: "hotel-transfer", label: "booking.hotelTransfer", description: "booking.hotelChoice", icon: Hotel },
] as const;

export default function BookingPage() {
  return <Suspense><BookingForm /></Suspense>;
}

function BookingForm() {
  const params = useSearchParams();
  const { t } = useLanguage();
  const { user } = useAuth();
  const steps = [t("booking.route"), t("booking.details"), t("booking.flightNumber"), t("booking.review")];
  const [step, setStep] = useState(0);
  const [passengers, setPassengers] = useState(2);
  const [fromAddress, setFromAddress] = useState(() => (params.get("fromAddress") ?? (params.get("direction") === "city-to-airport" ? params.get("destination") ?? "" : "SAI Airport")).slice(0, 500));
  const [toAddress, setToAddress] = useState(() => (params.get("toAddress") ?? (params.get("direction") === "city-to-airport" ? "SAI Airport" : params.get("destination") ?? "")).slice(0, 500));
  const [direction, setDirection] = useState<"airport-to-city" | "city-to-airport">(params.get("direction") === "city-to-airport" ? "city-to-airport" : "airport-to-city");
  const [pickupDate, setPickupDate] = useState(() => /^\d{4}-\d{2}-\d{2}$/.test(params.get("date") ?? "") ? params.get("date")! : new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [pickupTime, setPickupTime] = useState(() => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(params.get("time") ?? "") ? params.get("time")! : "14:30");
  const [tripType, setTripType] = useState(() => tripOptions.some((option) => option.value === params.get("tripType")) ? params.get("tripType")! : "airport-transfer");
  const [tourCircuit, setTourCircuit] = useState("SMALL");
  const [tourHours, setTourHours] = useState(8);
  const [paymentMethod, setPaymentMethod] = useState<"ONLINE" | "DRIVER">("DRIVER");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [bookingId, setBookingId] = useState("");
  const [finalPrice, setFinalPrice] = useState(3000);
  const [finalCurrency, setFinalCurrency] = useState("USD");
  const [quoteState, setQuoteState] = useState<{ selection: string; priceCents: number; currency: string; fareDetails: FareDetails } | null>(null);
  const [quoteError, setQuoteError] = useState<"remote" | "general" | null>(null);
  const apiDirection = direction === "airport-to-city" ? "AIRPORT_TO_CITY" : "CITY_TO_AIRPORT";
  const apiTripType = tripType === "airport-transfer" ? "AIRPORT_TRANSFER" : tripType === "hotel-transfer" ? "HOTEL_TRANSFER" : tripType === "city-transfer" ? "CITY_TRANSFER" : tripType === "tourist-tour" ? "TOURIST_TOUR" : "PRIVATE_TRANSFER";
  const selection = JSON.stringify([apiDirection, apiTripType, fromAddress, toAddress, tourCircuit, tourHours]);
  const quote = quoteState?.selection === selection ? quoteState : null;
  const effectivePaymentMethod = apiTripType === "TOURIST_TOUR" ? "DRIVER" : paymentMethod;
  const tripLabel = (tripOptions.find((option) => option.value === tripType) ?? tripOptions[0]).label;
  const priceLabel = quote ? `${(quote.priceCents / 100).toFixed(2)} ${quote.currency}` : t(!fromAddress.trim() || !toAddress.trim() ? "fare.chooseRoute" : quoteError === "remote" ? "fare.remoteUnavailable" : quoteError ? "courses.quoteError" : "admin.loading");
  const [passenger, setPassenger] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: "", luggageCount: 2, specialNeeds: "", flightNumber: "", pickupNotes: "" });

  useEffect(() => {
    const controller = new AbortController();
    async function loadQuote() {
      try {
        if (!fromAddress.trim() || !toAddress.trim()) return;
        const query = new URLSearchParams({ direction: apiDirection, tripType: apiTripType, fromAddress, toAddress, tourCircuit, tourHours: String(tourHours) });
        const response = await fetch(`/api/bookings/quote?${query}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) {
          if (!controller.signal.aborted) setQuoteError(response.status === 422 ? "remote" : "general");
          return;
        }
        const value = z.object({ priceCents: z.number().int().nonnegative(), currency: z.string(), fareDetails: fareDetailsSchema }).parse(await response.json());
        if (!controller.signal.aborted) { setQuoteState({ selection, ...value }); setQuoteError(null); }
      } catch {
        if (!controller.signal.aborted) setQuoteError("general");
      }
    }
    const timer = setTimeout(() => void loadQuote(), 500);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [apiDirection, apiTripType, selection, fromAddress, toAddress, tourCircuit, tourHours]);

  async function continueBooking(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < steps.length - 1) {
      setStep((currentStep) => currentStep + 1);
      return;
    }
    if (pending || !quote) return;
    setPending(true); setError("");
    try {
      const response = await fetch("/api/bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        fromAddress, toAddress,
        direction: apiDirection, tripType: apiTripType, paymentMethod: effectivePaymentMethod, tourCircuit, tourHours, contactPhone: passenger.phone.trim(),
        pickupAt: new Date(`${pickupDate}T${pickupTime}:00+07:00`).toISOString(), passengers,
        luggageCount: passenger.luggageCount, specialNeeds: passenger.specialNeeds, flightNumber: passenger.flightNumber,
        pickupNotes: `${passenger.pickupNotes}\nPassenger: ${passenger.name}; ${passenger.email}; ${passenger.phone}`,
      }) });
      if (!response.ok) throw new Error("Booking rejected");
      const result = z.object({ booking: z.object({ id: z.string(), reference: z.string(), priceCents: z.number(), currency: z.string(), fareDetails: fareDetailsSchema }) }).parse(await response.json());
      setQuoteState({ selection, priceCents: result.booking.priceCents, currency: result.booking.currency, fareDetails: result.booking.fareDetails });
      setBookingId(result.booking.id); setReference(result.booking.reference); setFinalPrice(result.booking.priceCents); setFinalCurrency(result.booking.currency); setSubmitted(true);
    } catch { setError(t("courses.submitError")); }
    finally { setPending(false); }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/ride" className="mb-5 inline-flex min-h-12 items-center rounded-xl border border-blue-200 bg-white px-4 py-3 font-bold text-blue-900">{t("guest.open")}</Link>
      <header className="relative mb-8 overflow-hidden rounded-[32px] bg-[var(--color-primary-dark)] px-6 py-9 text-white md:px-10 md:py-12">
        <Plane aria-hidden="true" className="pointer-events-none absolute -right-8 top-4 h-64 w-64 -rotate-12 text-white/5" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.24em] text-white/70">SAIWAY · SIEM REAP</p>
        <h1 className="relative mt-4 max-w-2xl text-3xl font-black leading-tight tracking-tight md:text-5xl">{t("booking.heroTitle")}</h1>
        <p className="relative mt-4 max-w-xl text-sm leading-7 text-white/80 md:text-base">{t("booking.heroText")}</p>
        <div className="relative mt-6 flex flex-wrap gap-3 text-xs font-semibold"><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><ShieldCheck size={16} />{t("booking.fareIncluded")}</span><span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2"><Wallet size={16} />{t("booking.paymentFlexible")}</span></div>
      </header>
      {!user || user.role !== "customer" ? (
        <section className="mx-auto max-w-2xl rounded-[32px] border border-[var(--color-accent)]/30 bg-white p-8 text-center shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-accent)]">{t("booking.accountRequired")}</p>
          <h1 className="mt-3 text-3xl font-black text-[var(--color-text)]">{t("booking.accountTitle")}</h1>
          <p className="mt-4 leading-7 text-slate-600">{t("booking.accountText")}</p>
          <Link href="/auth" className="mt-6 inline-flex rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">{t("booking.registerSignIn")}</Link>
        </section>
      ) : (
      <div className="mx-auto max-w-4xl">
        <section className="min-w-0 rounded-[32px] border border-black/5 bg-white p-5 shadow-[0_18px_60px_rgba(23,34,31,0.06)] sm:p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{t("booking.titleEyebrow")}</p>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-[var(--color-text)]">{t("booking.title")}</h2>
              <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck size={16} className="shrink-0" />{t("booking.secureAccount")}</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-background)] px-4 py-3 text-right">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{t(apiTripType === "TOURIST_TOUR" ? "fare.provisionalPrice" : "fare.calculatedPrice")}</div>
              <div className="mt-1 text-2xl font-black text-[var(--color-primary)]">{submitted ? `${(finalPrice / 100).toFixed(2)} ${finalCurrency}` : priceLabel}</div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={t("ui.progress")}>
            {steps.map((label, index) => (
              <div key={label} title={label} aria-label={label} aria-current={index === step ? "step" : undefined} className={`flex min-w-0 flex-col items-start gap-2 rounded-2xl p-3 text-xs font-semibold ${index === step ? "bg-emerald-50" : "bg-slate-50"}`}>
                <span className={`flex h-8 w-8 items-center justify-center rounded-full ${index <= step ? "bg-[var(--color-primary)] text-white" : "bg-slate-100 text-slate-400"}`}>
                  {index < step ? <Check size={16} /> : index + 1}
                </span>
                <span className={`min-w-0 max-w-full break-words ${index <= step ? "text-[var(--color-text)]" : "text-slate-400"}`}>{label}</span>
              </div>
            ))}
          </div>

          {submitted ? (
            <div className="mt-10 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
              <div className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">{t("booking.requestReceived")}</div>
              <h2 className="mt-3 text-2xl font-black text-[var(--color-text)]">{t("courses.saved")}</h2>
              <p className="mt-3 text-slate-600">{reference} · {(finalPrice / 100).toFixed(2)} {finalCurrency}</p>
              <p className="mt-3 text-sm text-slate-600">{t(effectivePaymentMethod === "DRIVER" ? "booking.driverBooked" : "customer.pendingNotice")}</p>
              <Link href={`/account?booking=${encodeURIComponent(bookingId)}`} className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">{t(effectivePaymentMethod === "ONLINE" ? "booking.finishPayment" : "customer.trips")}<ArrowRight size={16} /></Link>
            </div>
          ) : (
            <form onSubmit={continueBooking} className="mt-10 space-y-6">
              <fieldset disabled={pending} className="contents">
              {error && <p role="alert" className="text-[var(--color-error)]">{error}</p>}
              <fieldset className="space-y-3">
                <legend className="mb-2 text-lg font-bold">{t("booking.tripType")}</legend>
                <p className="text-sm leading-6 text-slate-500">{t("booking.chooseTransfer")}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {tripOptions.map(({ value, label, description, icon: Icon }) => <label key={value} className={`flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl border p-4 ${tripType === value ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5" : "border-slate-200"}`}>
                    <input type="radio" name="tripType" value={value} checked={tripType === value} onChange={() => setTripType(value)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
                    <Icon size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--color-primary)]" />
                    <span className="min-w-0"><strong className="block text-sm">{t(label)}</strong><span className="mt-1 block text-xs leading-5 text-slate-600">{t(description)}</span></span>
                  </label>)}
                </div>
                {tripType === "tourist-tour" && <div className="grid gap-4 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
                  <label className="text-sm font-semibold">{t("fare.circuit")}<select className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3" value={tourCircuit} onChange={(event) => setTourCircuit(event.target.value)}><option value="SMALL">{t("fare.small")}</option><option value="GRAND">{t("fare.grand")}</option><option value="REMOTE">{t("fare.remote")}</option></select></label>
                  <label className="text-sm font-semibold">{t("fare.bookedHours")}<input className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3" type="number" min="1" max="48" step="0.5" required value={tourHours} onChange={(event) => setTourHours(Number(event.target.value))} /></label>
                </div>}
              </fieldset>
              <p className="text-sm text-slate-500">{t("courses.quoteNotice")}</p>
              {step === 0 && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 p-4">
                    <span className="text-sm font-semibold">{t("booking.passengers")}</span>
                    <div className="flex items-center gap-4"><button type="button" aria-label={t("ui.removePassenger")} disabled={passengers === 1} onClick={() => setPassengers((count) => Math.max(1, count - 1))} className="h-11 w-11 rounded-full border border-slate-300 disabled:opacity-40">−</button><span className="font-bold">{passengers}</span><button type="button" aria-label={t("ui.addPassenger")} disabled={passengers === 8} onClick={() => setPassengers((count) => Math.min(8, count + 1))} className="h-11 w-11 rounded-full border border-slate-300 disabled:opacity-40">+</button></div>
                  </div>
                  <PickupLocation value={fromAddress} onChange={setFromAddress} />
                  <HotelSearch value={toAddress} onChange={setToAddress} label={t("booking.to")} placeholder={t("booking.destinationPlaceholder")} />
                  <p className="text-xs text-slate-500">{t("places.searchNotice")}</p>
                  <button type="button" onClick={() => { setDirection((current) => current === "airport-to-city" ? "city-to-airport" : "airport-to-city"); setFromAddress(toAddress); setToAddress(fromAddress); }} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10" aria-label={t("booking.swapRoute")}>
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
                    <input id="name" required value={passenger.name} onChange={(event) => setPassenger({ ...passenger, name: event.target.value })} placeholder={t("booking.fullName")} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.email")}</label>
                      <input id="email" type="email" required value={passenger.email} onChange={(event) => setPassenger({ ...passenger, email: event.target.value })} placeholder="you@example.com" className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                    <div>
                      <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.phone")}</label>
                      <input id="phone" type="tel" required maxLength={30} pattern="\+?[\d\s\(\)\.\-]{8,}" autoComplete="tel" value={passenger.phone} onChange={(event) => setPassenger({ ...passenger, phone: event.target.value })} placeholder="+855 ..." className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="luggage" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.luggageCount")}</label>
                      <input id="luggage" type="number" min="0" max="20" value={passenger.luggageCount} onChange={(event) => setPassenger({ ...passenger, luggageCount: Number(event.target.value) })} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                    <div>
                      <label htmlFor="special-needs" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.specialNeeds")}</label>
                      <input id="special-needs" value={passenger.specialNeeds} onChange={(event) => setPassenger({ ...passenger, specialNeeds: event.target.value })} placeholder={t("booking.specialNeedsPlaceholder")} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <div>
                    <label htmlFor="flight-number" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.flightNumber")}</label>
                    <input id="flight-number" value={passenger.flightNumber} onChange={(event) => setPassenger({ ...passenger, flightNumber: event.target.value })} placeholder={t("booking.flightPlaceholder")} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                    <p className="mt-2 text-xs text-slate-500">{t("booking.flightHelp")}</p>
                  </div>
                  <div>
                    <label htmlFor="pickup-notes" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("booking.notes")}</label>
                    <textarea id="pickup-notes" value={passenger.pickupNotes} onChange={(event) => setPassenger({ ...passenger, pickupNotes: event.target.value })} rows={3} placeholder={t("booking.notesPlaceholder")} className="w-full resize-none rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-5"><div className="rounded-3xl bg-[var(--color-background)] p-5 text-sm text-slate-600">
                  <h2 className="mb-5 text-lg font-bold text-[var(--color-text)]">{t("booking.reviewDetails")}</h2>
                  <div className="flex flex-wrap justify-between gap-4"><span>{t("booking.route")}</span><strong className="min-w-0 break-words text-right text-[var(--color-text)]">{fromAddress} → {toAddress}</strong></div>
                  <div className="mt-4 flex justify-between gap-4"><span>{t("booking.pickup")}</span><strong className="text-[var(--color-text)]">{pickupDate} · {pickupTime}</strong></div>
                  <div className="mt-4 flex justify-between gap-4"><span>{t("booking.passengers")}</span><strong className="text-[var(--color-text)]">{passengers}</strong></div>
                  <div className="mt-4 flex justify-between gap-4"><span>{t("booking.tripType")}</span><strong className="text-[var(--color-text)]">{t(tripLabel)}</strong></div>
                  <div className="mt-4 flex justify-between gap-4"><span>{t("booking.contactDetails")}</span><strong className="text-right text-[var(--color-text)]">{t("booking.passengerProvided")}</strong></div>
                  <div className="mt-4 flex justify-between gap-4 border-t border-black/10 pt-4"><span>{t("ui.total")}</span><strong className="text-xl text-[var(--color-primary)]">{priceLabel}</strong></div>
                </div><fieldset className="space-y-3"><legend className="mb-3 text-lg font-bold">{t("payment.method")}</legend>
                  {(["DRIVER", "ONLINE"] as const).map((method) => <label key={method} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${effectivePaymentMethod === method ? "border-[var(--color-primary)] bg-emerald-50" : "border-slate-200"} ${tripType === "tourist-tour" && method === "ONLINE" ? "cursor-not-allowed opacity-60" : ""}`}>
                    <input type="radio" name="bookingPayment" value={method} checked={effectivePaymentMethod === method} disabled={tripType === "tourist-tour" && method === "ONLINE"} onChange={() => setPaymentMethod(method)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]" />
                    {method === "ONLINE" ? <CreditCard size={20} className="mt-0.5 shrink-0" /> : <Wallet size={20} className="mt-0.5 shrink-0" />}
                    <span><strong className="block text-sm">{t(method === "ONLINE" ? "payment.online" : "payment.atDriver")}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{t(method === "ONLINE" ? "booking.paymentHelp" : "booking.driverPaymentHelp")}</span></span>
                  </label>)}
                  {tripType === "tourist-tour" && <p className="text-sm text-slate-600">{t("payment.tourOnlineUnavailable")}</p>}
                </fieldset></div>
              )}

              <div className="rounded-2xl bg-slate-50 p-4">
                <FareSummary details={quote?.fareDetails} />
                <p className="mt-3 text-xs leading-6 text-slate-500">{t("courses.vehiclePending")}</p>
                {tripType === "airport-transfer" && <p className="mt-2 text-xs leading-6 text-slate-500">{t("booking.waiting")}</p>}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6">
                <button type="button" onClick={() => setStep((currentStep) => Math.max(0, currentStep - 1))} disabled={step === 0 || pending} className="rounded-full px-4 py-3 text-sm font-semibold text-slate-500 disabled:invisible">{t("booking.back")}</button>
                <Button type="submit" disabled={pending || step === steps.length - 1 && !quote}>{pending ? t("admin.saving") : step === steps.length - 1 ? t("booking.requestTransfer") : t("booking.continue")}</Button>
              </div>
              </fieldset>
            </form>
          )}
        </section>

      </div>
      )}
    </div>
  );
}
