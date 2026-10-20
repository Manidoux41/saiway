"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { ArrowDown, ArrowRight, BriefcaseBusiness, CalendarDays, Check, CheckCheck, ChevronRight, Clock3, ExternalLink, FlaskConical, Mail, MapPin, Navigation, Plane, RefreshCw, Search, ShieldCheck, Users, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { courseSchema, type Course } from "@/components/booking/course-dashboard";
import { useLanguage } from "@/components/i18n/language-provider";
import { closedDriverStatuses, createDemoCourses, driverNextStatus, driverSummary, driverTimeZone, filterDriverCourses, navigationUrl, type DriverTab } from "@/lib/driver-dashboard";
import styles from "./driver-dashboard.module.css";

const TripMap = dynamic(() => import("./trip-map"), { ssr: false, loading: () => <div className="h-[370px] animate-pulse bg-slate-100" /> });
const bookingsSchema = z.object({ bookings: z.array(courseSchema) });
const transitionKeys = {
  DRIVER_ASSIGNED: "driver.acceptTrip", DRIVER_ACCEPTED: "driver.depart", DRIVER_EN_ROUTE: "driver.arrive", DRIVER_ARRIVED: "driver.start", TRIP_STARTED: "driver.finish",
} as const;
const statusKeys = {
  DRIVER_ASSIGNED: "courses.assigned", DRIVER_ACCEPTED: "courses.accepted", DRIVER_EN_ROUTE: "courses.enRoute", DRIVER_ARRIVED: "courses.arrived", TRIP_STARTED: "courses.started", TRIP_COMPLETED: "courses.completed", CANCELLED: "courses.cancelled", NO_SHOW: "driver.noShow", REFUNDED: "driver.refunded",
} as const;
const steps = ["DRIVER_ASSIGNED", "DRIVER_ACCEPTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED", "TRIP_COMPLETED"] as const;

export function DriverDashboard() {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [demoCourses, setDemoCourses] = useState<Course[]>([]);
  const [mode, setMode] = useState<"auto" | "real" | "demo">("auto");
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [revision, setRevision] = useState(0);
  const [tab, setTab] = useState<DriverTab>("today");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/driver/bookings", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Load failed");
        const result = bookingsSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setCourses(result.bookings);
        setLoaded(true);
        setError("");
        if (user) setDemoCourses((current) => current.length ? current : createDemoCourses(user));
      } catch {
        if (!controller.signal.aborted) setError(t("courses.loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [revision, t, user]);

  const demo = mode === "demo" || mode === "auto" && loaded && courses.length === 0;
  const source = demo ? demoCourses : courses;
  const summary = driverSummary(source, now);
  const visible = filterDriverCourses(source, tab, query, now).filter((course) => !status || course.status === status);
  const selected = visible.find((course) => course.id === selectedId) ?? visible[0];
  const scheduled = filterDriverCourses(source, "upcoming", "", now);
  const next = scheduled.find((course) => ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"].includes(course.status)) ?? scheduled[0];
  const formatDate = (value: string | Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language, { ...options, timeZone: driverTimeZone }).format(new Date(value));
  const money = (cents: number, currency: string) => new Intl.NumberFormat(language, { style: "currency", currency }).format(cents / 100);
  const label = (value: string) => t(statusKeys[value as keyof typeof statusKeys] ?? "courses.pending");

  function refresh() { setLoading(true); setRevision((current) => current + 1); }
  function switchMode(value: "real" | "demo") {
    if (pending) return;
    setMode(value); setSelectedId(null); setStatus(""); setQuery(""); setMessage("");
    if (value === "demo" && !demoCourses.length && user) setDemoCourses(createDemoCourses(user));
  }

  async function advance(course: Course) {
    const nextStatus = driverNextStatus[course.status];
    if (!nextStatus || pending || loading || !source.some((item) => item.id === course.id)) return;
    setMessage("");
    if (demo) {
      setDemoCourses((current) => current.map((item) => item.id === course.id ? { ...item, status: nextStatus } : item));
      setMessage(t("driver.updated"));
      return;
    }
    if (course.id.startsWith("demo-")) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/driver/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: course.id, status: nextStatus }) });
      if (!response.ok) throw new Error("Update failed");
      const result = z.object({ booking: courseSchema }).parse(await response.json());
      setCourses((current) => current.map((item) => item.id === result.booking.id ? result.booking : item));
      setMessage(t("driver.updated"));
    } catch { setError(t("courses.saveError")); }
    finally { setPending(false); }
  }

  return <div className={styles.dashboard}>
    <header className={styles.heading}>
      <div><p className={styles.eyebrow}>SAIWAY / {t("nav.driverDashboard")}</p><h1>{t("driver.greeting")}{user ? `, ${user.name.split(" ")[0]}` : ""}.</h1><p className={styles.date}><CalendarDays size={16} aria-hidden="true" />{formatDate(now, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}<span>{t("driver.localTime")}</span></p></div>
      <button type="button" className={styles.iconButton} title={t("driver.refresh")} aria-label={t("driver.refresh")} disabled={loading || pending} onClick={refresh}><RefreshCw size={19} className={loading ? "animate-spin" : ""} /></button>
    </header>

    <div className={styles.sourceBar}>
      <div className={styles.segment} role="group" aria-label={t("courses.driverTitle")}>
        <button type="button" aria-pressed={!demo} disabled={pending} onClick={() => switchMode("real")}><BriefcaseBusiness size={16} />{t("driver.real")}<span>{courses.length}</span></button>
        <button type="button" aria-pressed={demo} disabled={pending} onClick={() => switchMode("demo")}><FlaskConical size={16} />{t("driver.demo")}</button>
      </div>
      {demo && <button type="button" className={styles.iconButton} title={t("driver.resetDemo")} aria-label={t("driver.resetDemo")} onClick={() => { if (user) setDemoCourses(createDemoCourses(user)); setSelectedId(null); setMessage(""); }}><RefreshCw size={17} /></button>}
    </div>
    {demo && <p className={styles.demoNotice}><FlaskConical size={18} aria-hidden="true" />{t("driver.demoNotice")}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.success}><Check size={16} />{message}</p>}

    <section className={styles.metrics} aria-label={t("driver.today")} aria-busy={loading}>
      {[
        { icon: Navigation, title: t("driver.remaining"), value: summary.remaining },
        { icon: CheckCheck, title: t("driver.completedToday"), value: summary.completed },
        { icon: Users, title: t("driver.passengersToday"), value: summary.passengers },
        { icon: Wallet, title: t("driver.expectedFares"), value: Object.entries(summary.totals).map(([currency, cents]) => money(cents, currency)).join(" + ") || "—" },
      ].map(({ icon: Icon, title, value }) => <div key={title}><div className={styles.metricLabel}><Icon size={17} aria-hidden="true" /><span>{title}</span></div><strong>{loading && !loaded ? "…" : value}</strong></div>)}
    </section>
    <p className={styles.fareNote}>{t("driver.expectedNote")}</p>

    {next && <button type="button" className={styles.nextTrip} onClick={() => { setTab("upcoming"); setSelectedId(next.id); setStatus(""); setQuery(""); }}>
      <span className={styles.nextTime}><Clock3 size={18} /><span>{t("driver.next")}<strong>{formatDate(next.pickupAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</strong></span></span>
      <span className={styles.nextRoute}><span>{next.fromAddress}</span><ArrowRight size={16} /><span>{next.toAddress}</span></span><ChevronRight size={20} className="shrink-0" />
    </button>}

    <div className={styles.workspace}>
      <section className={styles.planning} aria-busy={loading}>
        <div className={styles.sectionTitle}><h2>{t("driver.planning")}</h2><span>{visible.length}</span></div>
        <div className={styles.tabs} role="tablist" aria-label={t("driver.planning")}>
          {(["today", "upcoming", "history"] as const).map((value) => <button key={value} id={`driver-tab-${value}`} type="button" role="tab" aria-controls="driver-trip-list" aria-selected={tab === value} onClick={() => { setTab(value); setStatus(""); }}>{t(value === "today" ? "driver.today" : value === "upcoming" ? "driver.tomorrow" : "driver.history")}</button>)}
        </div>
        <div className={styles.filters}>
          <label className={styles.search}><Search size={17} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("driver.search")} aria-label={t("driver.search")} /></label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t("records.status")}><option value="">{t("driver.allStatuses")}</option>{[...new Set(filterDriverCourses(source, tab, "", now).map((course) => course.status))].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select>
        </div>
        <div id="driver-trip-list" role="tabpanel" aria-labelledby={`driver-tab-${tab}`} className={styles.tripList}>
          {loading && !loaded && <p role="status" className={styles.empty}>{t("admin.loading")}</p>}
          {!loading && visible.length === 0 && <p className={styles.empty}>{t("driver.noTrips")}</p>}
          {visible.map((course) => <button key={course.id} type="button" className={`${styles.trip} ${selected?.id === course.id ? styles.selectedTrip : ""}`} aria-pressed={selected?.id === course.id} onClick={() => setSelectedId(course.id)}>
            <span className={styles.tripTop}><strong>{formatDate(course.pickupAt, { hour: "2-digit", minute: "2-digit" })}</strong><span className={styles.badge} data-status={course.status}>{label(course.status)}</span></span>
            <span className={styles.reference}>{formatDate(course.pickupAt, { day: "numeric", month: "short" })} · {course.reference}</span>
            <span className={styles.addressLine}><span className={styles.pickupDot} />{course.fromAddress}</span>
            <span className={styles.addressLine}><span className={styles.dropoffDot} />{course.toAddress}</span>
            <span className={styles.tripBottom}><span>{course.customer.name} · <Users size={14} /> {course.passengers}</span><strong>{money(course.priceCents, course.currency)}</strong></span>
            {!closedDriverStatuses.includes(course.status) && new Date(course.pickupAt) < now && course.status !== "TRIP_STARTED" && <span className={styles.overdue}>{t("driver.overdue")}</span>}
          </button>)}
        </div>
      </section>

      <section className={styles.detail} aria-label={t("driver.selected")}>
        {selected ? <>
          <div className={styles.sectionTitle}><h2>{t("driver.map")}</h2><a href={navigationUrl(selected)} target="_blank" rel="noopener noreferrer" className={styles.navigationLink}><Navigation size={16} />{t("driver.navigate")}<ExternalLink size={13} /></a></div>
          <div className={styles.mapFrame}><TripMap key={`${selected.id}-${revision}-${language}`} course={selected} demo={demo} /></div>
          <p className={styles.mapNote}>{t("driver.mapPrivacy")}</p>
          <div className={styles.detailHeading}><div><p className={styles.eyebrow}>{selected.reference}</p><h3>{selected.customer.name}</h3></div><span className={styles.badge} data-status={selected.status}>{label(selected.status)}</span></div>
          <div className={styles.routeDetail}><div><MapPin size={18} className="text-[var(--color-primary)]" /><span><small>{t("driver.pickupPoint")}</small>{selected.fromAddress}</span></div><ArrowDown size={16} className="ml-px text-slate-400" /><div><MapPin size={18} className="text-[var(--color-accent)]" /><span><small>{t("driver.dropoffPoint")}</small>{selected.toAddress}</span></div></div>
          <dl className={styles.facts}>
            <div><dt><Clock3 size={16} />{t("courses.pickup")}</dt><dd>{formatDate(selected.pickupAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</dd></div>
            <div><dt><Plane size={16} />{t("booking.flightNumber")}</dt><dd>{selected.flightNumber ?? "—"}</dd></div>
            <div><dt><Users size={16} />{t("booking.passengers")}</dt><dd>{selected.passengers} · {selected.luggageCount} {t("booking.luggage")}</dd></div>
            <div><dt><Wallet size={16} />{t("driver.tripFare")}</dt><dd>{money(selected.priceCents, selected.currency)}</dd></div>
            <div className="col-span-2"><dt><BriefcaseBusiness size={16} />{t("booking.vehicle")}</dt><dd>{selected.vehicle ? `${selected.vehicle.name} · ${selected.vehicle.plate} · ${selected.vehicle.seats} ${t("records.seats")}` : t("courses.vehiclePending")}</dd></div>
          </dl>
          {selected.pickupNotes && <div className={styles.notes}><h4>{t("booking.notes")}</h4><p>{selected.pickupNotes}</p></div>}
          {selected.specialNeeds && <div className={styles.specialNeeds}><h4>{t("booking.specialNeeds")}</h4><p>{selected.specialNeeds}</p></div>}
          {steps.includes(selected.status as typeof steps[number]) && <ol className={styles.progress} aria-label={t("records.status")}>{steps.map((step, index) => <li key={step} data-done={index <= steps.indexOf(selected.status as typeof steps[number])} aria-current={step === selected.status ? "step" : undefined}><span>{index < steps.indexOf(selected.status as typeof steps[number]) ? <Check size={12} /> : index + 1}</span><small>{label(step)}</small></li>)}</ol>}
          <div className={styles.actions}>
            {driverNextStatus[selected.status] && <button type="button" className={styles.primaryButton} disabled={pending || loading} onClick={() => void advance(selected)}>{pending ? t("admin.saving") : t(transitionKeys[selected.status as keyof typeof transitionKeys])}<ArrowRight size={18} /></button>}
            {!demo && <a className={styles.iconButton} href={`mailto:${selected.customer.email}`} title={t("driver.email")} aria-label={t("driver.email")}><Mail size={19} /></a>}
          </div>
        </> : <div className={styles.emptyMap}><MapPin size={36} /><p>{t("driver.selectTrip")}</p></div>}
      </section>
    </div>

    <details className={styles.account}><summary><ShieldCheck size={18} />{t("driver.account")}</summary><ChangePasswordForm /></details>
  </div>;
}