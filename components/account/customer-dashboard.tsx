"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { z } from "zod";
import { ArrowRight, CalendarDays, CheckCheck, Clock3, CreditCard, Headphones, MapPin, Plus, RefreshCw, Save, Search, UserRound, Users } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { useLanguage } from "@/components/i18n/language-provider";
import { useBookings } from "@/components/booking/use-bookings";
import type { Course } from "@/components/booking/course-dashboard";
import { closedDriverStatuses, driverTimeZone } from "@/lib/driver-dashboard";
import styles from "./customer-dashboard.module.css";

const paymentResult = z.object({ paid: z.boolean(), checkoutUrl: z.url().optional(), sandbox: z.boolean().optional() });
const profileSchema = z.object({ name: z.string(), email: z.string(), phone: z.string().nullable(), customer: z.object({ address: z.string().nullable() }).nullable() });
const statusKeys = { PENDING_PAYMENT: "customer.waitingPayment", CONFIRMED: "customer.confirmed", DRIVER_ASSIGNMENT_PENDING: "dispatch.toAssign", DRIVER_ASSIGNED: "courses.assigned", DRIVER_ACCEPTED: "courses.accepted", DRIVER_EN_ROUTE: "courses.enRoute", DRIVER_ARRIVED: "courses.arrived", TRIP_STARTED: "courses.started", TRIP_COMPLETED: "courses.completed", CANCELLED: "courses.cancelled", NO_SHOW: "driver.noShow", REFUNDED: "driver.refunded" } as const;

function CustomerProfile() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", phone: "", address: "" });
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/account/profile", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Profile unavailable");
        const value = profileSchema.parse(await response.json());
        if (!controller.signal.aborted) { setForm({ name: value.name, phone: value.phone ?? "", address: value.customer?.address ?? "" }); setLoaded(true); }
      } catch { if (!controller.signal.aborted) setError(true); }
    }
    void load(); return () => controller.abort();
  }, []);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending) return;
    setPending(true); setError(false); setSaved(false);
    try {
      const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error("Save failed");
      profileSchema.parse(await response.json()); setSaved(true);
    } catch { setError(true); } finally { setPending(false); }
  }
  return <section className={styles.profile}><h2>{t("customer.profileTitle")}</h2>{!loaded && !error && <p role="status">{t("customer.profileLoad")}</p>}{error && <p role="alert" className={styles.error}>{t("customer.profileError")}</p>}{saved && <p role="status" className={styles.success}>{t("customer.profileSaved")}</p>}<form onSubmit={save}><fieldset disabled={!loaded || pending}>
    <label>{t("records.name")}<input name="name" autoComplete="name" required maxLength={200} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
    <label>{t("records.phone")}<input name="phone" type="tel" autoComplete="tel" maxLength={30} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
    <label>{t("customer.address")}<textarea name="address" autoComplete="street-address" maxLength={500} rows={3} value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
    <button className={styles.primaryButton} type="submit"><Save size={17} />{t(pending ? "admin.saving" : "customer.profileSave")}</button>
  </fieldset></form></section>;
}

export function CustomerDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [pending, setPending] = useState(false);
  const lock = useRef(false);
  const { courses, loaded, loading, error, refresh } = useBookings("/api/bookings", pending);
  const [section, setSection] = useState<"trips" | "profile">("trips");
  const [view, setView] = useState<"upcoming" | "payment" | "history" | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(() => typeof window === "undefined" ? null : new URL(window.location.href).searchParams.get("booking"));
  const [message, setMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [now, setNow] = useState(() => new Date());
  const checkedReturn = useRef(false);
  const paid = (course: Course) => Boolean(course.payments?.some((item) => item.status === "PAID"));
  const closed = (course: Course) => closedDriverStatuses.includes(course.status);
  const upcoming = courses.filter((course) => !closed(course) && new Date(course.pickupAt) > now);
  const awaiting = upcoming.filter((course) => !paid(course));
  const search = query.trim().toLocaleLowerCase();
  const visible = courses.filter((course) => (view === "all" || (view === "history" ? closed(course) : view === "payment" ? !closed(course) && !paid(course) : !closed(course))) && (!search || [course.reference, course.fromAddress, course.toAddress, course.flightNumber ?? ""].join(" ").toLocaleLowerCase().includes(search)))
    .sort((first, second) => Number(closed(first)) - Number(closed(second)) || (closed(first) ? Date.parse(second.pickupAt) - Date.parse(first.pickupAt) : Date.parse(first.pickupAt) - Date.parse(second.pickupAt)));
  const selected = visible.find((course) => course.id === selectedId) ?? visible[0];
  const next = upcoming[0];
  const date = (value: string) => new Intl.DateTimeFormat(language, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: driverTimeZone }).format(new Date(value));
  const money = (course: Course) => new Intl.NumberFormat(language, { style: "currency", currency: course.currency }).format(course.priceCents / 100);
  const statusLabel = (status: string) => t(statusKeys[status as keyof typeof statusKeys] ?? "courses.pending");

  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30_000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (!loaded || checkedReturn.current) return;
    checkedReturn.current = true;
    const params = new URL(window.location.href).searchParams;
    const bookingId = params.get("booking");
    if (params.get("payment") !== "return" || !bookingId || !courses.some((course) => course.id === bookingId)) return;
    async function verifyReturn() {
      try {
        const response = await fetch("/api/payments/payway/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId }) });
        if (!response.ok) throw new Error("Verify failed");
        const result = paymentResult.parse(await response.json());
        setMessage(t(result.paid ? "customer.paid" : "customer.notPaid"));
        if (result.paid) refresh();
      } catch { setActionError(t("customer.verifyError")); }
    }
    void verifyReturn();
  }, [loaded, courses, refresh, t]);

  async function payment(course: Course, action: "checkout" | "verify") {
    if (lock.current || pending || loading) return;
    lock.current = true; setPending(true); setActionError(""); setMessage("");
    try {
      const response = await fetch(`/api/payments/payway/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: course.id }) });
      if (!response.ok) {
        const payload = z.object({ error: z.string() }).safeParse(await response.json());
        setActionError(t(payload.success && payload.data.error === "PAYWAY_NOT_CONFIGURED" ? "customer.paymentUnavailable" : action === "verify" ? "customer.verifyError" : "customer.paymentError")); return;
      }
      const result = paymentResult.parse(await response.json());
      if (result.paid) { setMessage(t("customer.paid")); refresh(); }
      else if (action === "checkout" && result.checkoutUrl) {
        const url = new URL(result.checkoutUrl);
        if (url.protocol !== "https:" || !["checkout.payway.com.kh", "checkout-sandbox.payway.com.kh", "checkout-uat.payway.com.kh"].includes(url.hostname)) throw new Error("Invalid checkout URL");
        if (result.sandbox && !window.confirm(t("customer.sandbox"))) return;
        window.location.assign(url.href);
      } else setMessage(t("customer.notPaid"));
    } catch { setActionError(t(action === "verify" ? "customer.verifyError" : "customer.paymentError")); }
    finally { lock.current = false; setPending(false); }
  }
  async function cancel(course: Course) {
    if (lock.current || pending || !window.confirm(t("customer.cancelNotice"))) return;
    lock.current = true; setPending(true); setActionError(""); setMessage("");
    try {
      const response = await fetch("/api/bookings", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: course.id, status: "CANCELLED" }) });
      if (!response.ok) throw new Error("Cancel failed");
      if (paid(course)) setMessage(t("customer.refundNotice"));
      refresh();
    } catch { setActionError(t("courses.saveError")); } finally { lock.current = false; setPending(false); }
  }

  return <div className={styles.dashboard}>
    <header className={styles.heading}><div><p className={styles.eyebrow}>SAIWAY / {user?.name}</p><h1>{t("customer.title")}</h1><p>{t("customer.greeting")}</p></div><Link className={styles.primaryButton} href="/booking"><Plus size={18} />{t("customer.book")}</Link></header>
    <nav className={styles.navigation} aria-label={t("nav.account")}><button type="button" aria-pressed={section === "trips"} onClick={() => setSection("trips")}><CalendarDays size={17} />{t("customer.trips")}</button><button type="button" aria-pressed={section === "profile"} onClick={() => setSection("profile")}><UserRound size={17} />{t("customer.profile")}</button><Link href="/help"><Headphones size={17} />{t("nav.help")}</Link></nav>
    {section === "profile" ? <CustomerProfile /> : <>
      <section className={styles.metrics} aria-label={t("customer.trips")}>{[{ key: "upcoming", title: t("customer.upcoming"), value: upcoming.length, icon: CalendarDays }, { key: "payment", title: t("customer.waitingPayment"), value: awaiting.length, icon: CreditCard }, { key: "history", title: t("courses.completed"), value: courses.filter((course) => course.status === "TRIP_COMPLETED").length, icon: CheckCheck }].map(({ key, title, value, icon: Icon }) => <button type="button" key={key} onClick={() => setView(key as typeof view)}><span><Icon size={17} />{title}</span><strong>{loaded ? value : "…"}</strong></button>)}</section>
      {next && <button type="button" className={styles.nextTrip} onClick={() => { setSelectedId(next.id); setView("all"); setQuery(""); }}><Clock3 size={20} /><span><small>{t("customer.next")}</small><strong>{date(next.pickupAt)}</strong></span><span className={styles.nextDestination}>{next.toAddress}</span><ArrowRight size={18} /></button>}
      {(error || actionError) && <p role="alert" className={styles.error}>{error || actionError}</p>}{message && <p role="status" className={styles.success}>{message}</p>}
      <div className={styles.workspace}>
        <section className={styles.list} aria-busy={loading}><div className={styles.sectionHeading}><h2>{t("customer.trips")}</h2><button type="button" className={styles.iconButton} disabled={loading || pending} onClick={refresh} title={t("customer.refresh")} aria-label={t("customer.refresh")}><RefreshCw size={17} /></button></div>
          <div className={styles.filters} role="group" aria-label={t("customer.trips")}>{(["all", "upcoming", "payment", "history"] as const).map((value) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{t(value === "payment" ? "customer.waitingPayment" : `customer.${value}`)}</button>)}</div>
          <label className={styles.search}><Search size={17} /><input type="search" aria-label={t("customer.search")} placeholder={t("customer.search")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <div className={styles.tripList}>{visible.map((course) => <button type="button" key={course.id} className={styles.trip} aria-pressed={selected?.id === course.id} onClick={() => setSelectedId(course.id)}><span className={styles.tripTop}><strong>{date(course.pickupAt)}</strong><span className={styles.badge} data-paid={paid(course)}>{statusLabel(course.status)}</span></span><small>{course.reference}</small><span className={styles.route}><MapPin size={15} />{course.fromAddress}</span><span className={styles.route}><ArrowRight size={15} />{course.toAddress}</span><span className={styles.tripBottom}><span><Users size={14} />{course.passengers}</span><strong>{money(course)}</strong></span></button>)}</div>
          {!loaded && loading && <p role="status" className={styles.empty}>{t("admin.loading")}</p>}{loaded && !visible.length && <div className={styles.empty}><p>{t("customer.empty")}</p><Link href="/booking" className={styles.textLink}>{t("customer.book")}<ArrowRight size={15} /></Link></div>}
        </section>
        <section className={styles.details} aria-label={t("customer.details")}>{selected ? <>
          <div className={styles.sectionHeading}><h2>{t("customer.details")}</h2><span className={styles.badge} data-paid={paid(selected)}>{statusLabel(selected.status)}</span></div>
          <p className={styles.eyebrow}>{selected.reference}</p><div className={styles.detailRoute}><MapPin size={19} /><div><small>{t("booking.from")}</small><strong>{selected.fromAddress}</strong><ArrowRight size={17} /><small>{t("booking.to")}</small><strong>{selected.toAddress}</strong></div></div>
          <dl className={styles.facts}><div><dt>{t("courses.pickup")}</dt><dd>{date(selected.pickupAt)}</dd></div><div><dt>{t("dispatch.price")}</dt><dd>{money(selected)}</dd></div><div><dt>{t("booking.passengers")}</dt><dd>{selected.passengers} · {selected.luggageCount} {t("booking.luggage")}</dd></div><div><dt>{t("booking.flightNumber")}</dt><dd>{selected.flightNumber ?? "—"}</dd></div><div><dt>{t("customer.paymentLabel")}</dt><dd>{t(paid(selected) ? "customer.confirmed" : selected.payments?.some((item) => item.status === "PROCESSING") ? "customer.paymentInProgress" : "customer.noPayment")}</dd></div><div><dt>{t("admin.driver")}</dt><dd>{selected.driver?.user.name ?? t("courses.unassigned")}</dd></div></dl>
          {selected.vehicle ? <p className={styles.vehicle}>{selected.vehicle.name} · {selected.vehicle.plate} · {selected.vehicle.seats} {t("records.seats")}</p> : <p className={styles.muted}>{t("customer.vehiclePending")}</p>}
          {selected.pickupNotes && <div className={styles.notes}><h3>{t("booking.notes")}</h3><p>{selected.pickupNotes}</p></div>}{selected.specialNeeds && <div className={styles.notes}><h3>{t("booking.specialNeeds")}</h3><p>{selected.specialNeeds}</p></div>}
          {!paid(selected) && !closed(selected) && <div className={styles.payment}><CreditCard size={21} /><p>{t(new Date(selected.pickupAt) > now ? "customer.paymentNotice" : "customer.expired")}</p><button type="button" className={styles.primaryButton} disabled={pending || loading || new Date(selected.pickupAt) <= now} onClick={() => void payment(selected, "checkout")}><CreditCard size={17} />{t(pending ? "customer.preparing" : "customer.pay")}</button>{selected.payments?.some((item) => item.status === "PROCESSING") && <button type="button" className={styles.secondaryButton} disabled={pending || loading} onClick={() => void payment(selected, "verify")}><RefreshCw size={16} />{t("customer.verify")}</button>}</div>}
          {paid(selected) && !closed(selected) && <p className={styles.success}><CheckCheck size={18} />{t("customer.paid")}</p>}
          {!closed(selected) && ["PENDING_PAYMENT", "CONFIRMED", "DRIVER_ASSIGNMENT_PENDING", "DRIVER_ASSIGNED"].includes(selected.status) && <button type="button" className={styles.cancelButton} disabled={pending || loading} onClick={() => void cancel(selected)}>{t("courses.cancel")}</button>}
        </> : <div className={styles.empty}><MapPin size={30} /><p>{t("customer.empty")}</p></div>}</section>
      </div>
    </>}
  </div>;
}