"use client";

import { localizedDate, localizedNumber } from "@/lib/locale-format";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { z } from "zod";
import { ArrowDown, ArrowRight, BriefcaseBusiness, LocateFixed, LocateOff, CalendarDays, Check, CheckCheck, ChevronRight, Clock3, ExternalLink, FlaskConical, Mail, MapPin, MessageSquareText, Navigation, Phone, PhoneOff, Plane, RefreshCw, Search, ShieldCheck, Users, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import { courseSchema, type Course } from "@/components/booking/course-dashboard";
import { useBookings } from "@/components/booking/use-bookings";
import { useLanguage } from "@/components/i18n/language-provider";
import { closedDriverStatuses, contactLinks, createDemoCourses, customerContact, driverNextStatus, driverSummary, driverTimeZone, filterDriverCourses, navigationUrl, showDriverAbaQr, type ContactApp, type DriverTab } from "@/lib/driver-dashboard";
import { DriverLicenseCard } from "./driver-license-card";
import { DriverContactQrCard } from "./driver-contact-qr-card";
import { distanceMeters, useLocationSharing } from "./use-location-sharing";
import styles from "./driver-dashboard.module.css";
import type { FleetDriver } from "@/components/maps/fleet-map";
import { WalkupTrip } from "./walkup-trip";
import { FareSummary } from "@/components/booking/fare-summary";
import { circuitSchema } from "@/lib/fare-policy";
import { coordinateAddress } from "@/lib/booking-location";
import { DriverAvailability } from "./driver-availability";
import { VehicleExpenses } from "./vehicle-expenses";
import { PayrollPanel } from "@/components/admin/payroll-panel";

const TripMap = dynamic(() => import("./trip-map"), { ssr: false, loading: () => <div className="h-[370px] animate-pulse bg-slate-100" /> });
const SavedRouteMap = dynamic(() => import("@/components/maps/saved-route-map").then((module) => module.SavedRouteMap), { ssr: false });
const DriverFleetMap = dynamic(() => import("@/components/maps/fleet-map").then((module) => module.FleetMap), { ssr: false, loading: () => <div className="h-full animate-pulse bg-slate-100" /> });
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
  const [demoCourses, setDemoCourses] = useState<Course[]>(() => user ? createDemoCourses(user) : []);
  const [mode, setMode] = useState<"real" | "demo">("real");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const collectionLock = useRef(false);
  const { courses, setCourses, loaded, loading, error, setError, refresh, driverAvailability, setDriverAvailability } = useBookings("/api/driver/bookings", pending);
  const [tab, setTab] = useState<DriverTab>("today");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [tourCircuits, setTourCircuits] = useState<Record<string, "SMALL" | "GRAND" | "REMOTE" | "">>({});
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [now, setNow] = useState(() => new Date());
  const [collection, setCollection] = useState<{ bookingId: string; method: "CASH" | "CARD" | "ABA" | "OTHER" } | null>(null);
  // The contact block only renders after trips load in the browser, so reading storage here cannot cause a hydration mismatch.
  const [contactApp, setContactApp] = useState<ContactApp>(() => typeof window !== "undefined" && window.localStorage.getItem("saiway.driver.contactApp") === "telegram" ? "telegram" : "whatsapp");

  function chooseContactApp(value: ContactApp) {
    setContactApp(value);
    window.localStorage.setItem("saiway.driver.contactApp", value);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const demo = mode === "demo";
  const source = demo ? demoCourses : courses;
  const summary = driverSummary(source, now);
  const visible = filterDriverCourses(source, tab, query, now).filter((course) => !status || course.status === status);
  const selected = visible.find((course) => course.id === selectedId) ?? visible[0];
  const receipt = selected?.payments?.find((item) => item.status === "PAID");
  const phone = selected && !demo ? customerContact(selected) : null;
  const links = phone && selected ? contactLinks(phone, t("contact.smsBody").replace("{name}", selected.customer.name.split(" ")[0]).replace("{reference}", selected.reference)) : null;
  const scheduled = filterDriverCourses(source, "upcoming", "", now);
  const next = scheduled.find((course) => ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"].includes(course.status)) ?? scheduled[0];
  const liveTrip = demo ? undefined : courses.filter((course) => ["DRIVER_ASSIGNED", "DRIVER_ACCEPTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"].includes(course.status))
    .sort((a, b) => ["TRIP_STARTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "DRIVER_ACCEPTED", "DRIVER_ASSIGNED"].indexOf(a.status) - ["TRIP_STARTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "DRIVER_ACCEPTED", "DRIVER_ASSIGNED"].indexOf(b.status))[0];
  const sharing = useLocationSharing(liveTrip?.id ?? null, !demo && loaded);
  const currentPoint = sharing.detectedAt && now.getTime() - sharing.detectedAt.getTime() < 60000 ? sharing.point : null;
  const formatDate = (value: string | Date, options: Intl.DateTimeFormatOptions) => localizedDate(language, { ...options, timeZone: driverTimeZone }).format(new Date(value));
  const money = (cents: number, currency: string) => localizedNumber(language, { style: "currency", currency }).format(cents / 100);
  const label = (value: string) => t(statusKeys[value as keyof typeof statusKeys] ?? "courses.pending");
  const locationStatus: FleetDriver["status"] = liveTrip?.status === "TRIP_STARTED" ? "ON_TRIP"
    : liveTrip && ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED"].includes(liveTrip.status) ? "TO_PICKUP"
      : liveTrip ? "ASSIGNED"
        : sharing.returningToHub ? "RETURNING_TO_HUB" : driverAvailability?.isAvailable === false ? "UNAVAILABLE" : "AVAILABLE";
  const nearestHub = sharing.point && sharing.hubs.length ? sharing.hubs.reduce((nearest, hub) => {
    if (!nearest) return hub;
    return distanceMeters(sharing.point!, hub) < distanceMeters(sharing.point!, nearest) ? hub : nearest;
  }, sharing.hubs[0]!) : null;
  const driverMapItems: FleetDriver[] = sharing.point ? [{
    id: user?.id ?? "driver",
    name: user?.name ?? t("live.driver"),
    status: locationStatus,
    location: { ...sharing.point, recordedAt: sharing.lastSent?.toISOString() ?? new Date().toISOString() },
    booking: liveTrip ? { id: liveTrip.id, reference: liveTrip.reference, status: liveTrip.status } : null,
    vehicle: liveTrip?.vehicle ? { ...liveTrip.vehicle, iconCategory: liveTrip.vehicle.iconCategory } : sharing.vehicle,
    target: liveTrip
      ? { address: liveTrip.routeDetails ? coordinateAddress(liveTrip.status === "TRIP_STARTED" ? liveTrip.routeDetails.to : liveTrip.routeDetails.from) : liveTrip.status === "TRIP_STARTED" ? liveTrip.toAddress : liveTrip.fromAddress, hub: null }
      : sharing.returningToHub && nearestHub ? { address: null, hub: nearestHub } : null,
    stale: false,
  }] : [];

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
      const selectedCircuit = circuitSchema.safeParse(tourCircuits[course.id]);
      if (nextStatus === "TRIP_COMPLETED" && selectedCircuit.success && selectedCircuit.data !== course.fareDetails?.circuit && !window.confirm(t("fare.confirmUpgrade"))) return;
      const body = { id: course.id, status: nextStatus, ...(nextStatus === "TRIP_COMPLETED" ? { observations: observations[course.id] ?? "", ...(currentPoint ? { finalPoint: { latitude: currentPoint.latitude, longitude: currentPoint.longitude } } : {}) } : {}), ...(nextStatus === "TRIP_COMPLETED" && selectedCircuit.success ? { tourCircuit: selectedCircuit.data } : {}) };
      let response = await fetch("/api/driver/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (response.status === 409 && course.metered) {
        const failure = z.object({ error: z.string() }).safeParse(await response.clone().json());
        if (failure.success && failure.data.error === "GPS_INCOMPLETE_CONFIRM_ROUTE" && window.confirm(t("fare.confirmFallback"))) {
          response = await fetch("/api/driver/bookings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, confirmEstimatedDistance: true }) });
        }
      }
      if (!response.ok) throw new Error("Update failed");
      const result = z.object({ booking: courseSchema }).parse(await response.json());
      setCourses((current) => current.map((item) => item.id === result.booking.id ? result.booking : item));
      setMessage(t("driver.updated"));
      if (nextStatus === "TRIP_COMPLETED") { setTab("history"); setSelectedId(course.id); setStatus(""); setQuery(""); }
    } catch { setError(t("courses.saveError")); }
    finally { setPending(false); }
  }

  async function collectPayment(course: Course, received: boolean) {
    const method = collection?.bookingId === course.id ? collection.method : null;
    if (demo || course.id.startsWith("demo-") || collectionLock.current || pending || loading || course.status !== "TRIP_COMPLETED" || received && !method || course.payments?.some((item) => ["PAID", "PROCESSING"].includes(item.status))) return;
    if (!window.confirm(`${t(received ? "payment.confirmReceipt" : "payment.confirmUnpaid")}\n${money(course.priceCents, course.currency)} · ${course.reference}${received && method ? `\n${t(`payment.${method}`)}` : ""}`)) return;
    collectionLock.current = true; setPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/driver/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId: course.id, received, ...(received ? { collectionMethod: method } : {}) }) });
      if (!response.ok) throw new Error("Receipt confirmation failed");
      const result = z.object({ booking: courseSchema }).parse(await response.json());
      setCourses((current) => current.map((item) => item.id === result.booking.id ? result.booking : item));
      setMessage(t(received ? "payment.receiptSaved" : "payment.unpaidSaved"));
    } catch { setError(t("payment.receiptError")); }
    finally { collectionLock.current = false; setPending(false); }
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
      {!demo && <button type="button" className={styles.gpsButton} onClick={() => setTrackingOpen(true)} aria-label={t("driver.gpsFollow")}><LocateFixed size={18} />{t("driver.gpsFollow")}</button>}
      {demo && <button type="button" className={styles.iconButton} title={t("driver.resetDemo")} aria-label={t("driver.resetDemo")} onClick={() => { if (user) setDemoCourses(createDemoCourses(user)); setSelectedId(null); setMessage(""); }}><RefreshCw size={17} /></button>}
    </div>
    {demo && <p className={styles.demoNotice}><FlaskConical size={18} aria-hidden="true" />{t("driver.demoNotice")}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.success}><Check size={16} />{message}</p>}
    {!demo && <DriverAvailability value={driverAvailability} inService={courses.some((course) => ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"].includes(course.status))} disabled={loading || pending || !loaded}
      onPending={setPending} onSaved={(value) => { setDriverAvailability(value); sharing.retry(); refresh(); }} />}
    <WalkupTrip location={currentPoint} gpsPhase={sharing.phase} retryGps={sharing.retry} disabled={demo || loading || pending || courses.some((course) => ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"].includes(course.status))} onStarted={() => { setMode("real"); setTab("today"); refresh(); }} />
    {selected && <FareSummary details={selected.fareDetails} />}
    {selected?.status === "TRIP_STARTED" && selected.fareDetails?.mode === "TOUR" && <label className="my-3 block text-sm">{t("fare.circuitAtFinish")}
      <select value={tourCircuits[selected.id] ?? ""} onChange={(event) => {
        const parsed = circuitSchema.safeParse(event.target.value);
        setTourCircuits((current) => ({ ...current, [selected.id]: parsed.success ? parsed.data : "" }));
      }} disabled={pending || demo} className="ml-3 rounded-xl border p-2">
        <option value="">{t("fare.keepCircuit")}</option><option value="SMALL">{t("fare.small")}</option><option value="GRAND">{t("fare.grand")}</option>
        {selected.fareDetails.policy.remoteCircuitCents !== null && <option value="REMOTE">{t("fare.remote")}</option>}
      </select>
    </label>}

    {!demo && loaded && <section className={styles.liveShare} data-phase={sharing.phase} aria-live="polite">
      {sharing.phase === "sharing" || sharing.phase === "starting" ? <LocateFixed size={20} aria-hidden="true" /> : <LocateOff size={20} aria-hidden="true" />}
      <div>
        <strong>{t(`live.${sharing.phase === "error" ? "sendError" : sharing.phase}`)}</strong>
        <span>{liveTrip ? `${liveTrip.reference} · ${liveTrip.customer.name}` : t("live.adminOnlySharing")}{sharing.lastSent ? ` · ${t("live.lastSent")} ${formatDate(sharing.lastSent, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}</span>
        <small>{t("live.keepOpen")}</small>
        {liveTrip?.status === "DRIVER_EN_ROUTE" && <small>{t("live.autoArrival")}</small>}
      </div>
      {["denied", "unavailable", "timeout", "error"].includes(sharing.phase) && <button type="button" onClick={sharing.retry}>{t("live.retry")}</button>}
    </section>}

    {trackingOpen && <div className={styles.gpsOverlay} role="dialog" aria-modal="true" aria-label={t("driver.gpsFollow")}>
      <header><h2>{t("driver.gpsFollow")}</h2><button type="button" className={styles.iconButton} onClick={() => setTrackingOpen(false)} aria-label={t("driver.closeGpsMap")}><LocateOff size={18} /></button></header>
      {driverMapItems.length
        ? <DriverFleetMap drivers={driverMapItems} hubs={sharing.hubs} selectedId={driverMapItems[0]?.id ?? null} height="100%" />
        : <p role="status">{t(sharing.phase === "inactive" ? "live.inactive" : "live.noSignal")}</p>}
    </div>}

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
          <div className={styles.mapFrame}>{selected.routeDetails ? <SavedRouteMap route={selected.routeDetails} position={selected.status === "TRIP_STARTED" ? currentPoint : null} vehicle={selected.vehicle} /> : <TripMap key={`${selected.id}-${selected.fromAddress}-${selected.toAddress}-${language}`} course={selected} demo={demo} />}</div>
          {selected.routeDetails && <p className="p-3 text-sm">{(selected.routeDetails.distanceMeters / 1000).toFixed(2)} km · {Math.ceil(selected.routeDetails.durationSeconds / 60)} min</p>}
          {selected.startedAt && <p className="p-3 text-sm">{t("auto.started")}: {formatDate(selected.startedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>}
          {selected.completedAt && <p className="p-3 text-sm">{t("auto.completed")}: {formatDate(selected.completedAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {t("auto.actual")}: {Math.ceil((selected.actualDurationSeconds ?? 0) / 60)} min</p>}
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
          {!demo && <section className={styles.contact} aria-label={t("contact.title")}>
            <h4><Phone size={17} />{t("contact.title")}</h4>
            {links && phone ? <>
              <a className={styles.contactPhone} href={links.tel}>+{phone}</a>
              <div className={styles.segment} role="group" aria-label={t("contact.app")}>
                {(["whatsapp", "telegram"] as const).map((app) => <button key={app} type="button" aria-pressed={contactApp === app} onClick={() => chooseContactApp(app)}>{app === "whatsapp" ? "WhatsApp" : "Telegram"}</button>)}
              </div>
              <div className={styles.contactActions}>
                <a href={links[contactApp]} target="_blank" rel="noopener noreferrer"><Phone size={16} />{t("contact.call")} {contactApp === "whatsapp" ? "WhatsApp" : "Telegram"}</a>
                <a href={links.sms}><MessageSquareText size={16} />{t("contact.sms")}</a>
              </div>
              {contactApp === "telegram" && <p>{t("contact.telegramNote")}</p>}
            </> : <p className="flex items-center gap-2"><PhoneOff size={15} aria-hidden="true" />{t("contact.noPhone")}</p>}
          </section>}
          {steps.includes(selected.status as typeof steps[number]) && <ol className={styles.progress} aria-label={t("records.status")}>{steps.map((step, index) => <li key={step} data-done={index <= steps.indexOf(selected.status as typeof steps[number])} aria-current={step === selected.status ? "step" : undefined}><span>{index < steps.indexOf(selected.status as typeof steps[number]) ? <Check size={12} /> : index + 1}</span><small>{label(step)}</small></li>)}</ol>}
          {!demo && <section className={styles.collection} aria-label={t("customer.paymentLabel")}>
            <h4><Wallet size={17} />{t("customer.paymentLabel")}</h4>
            <p>{t(selected.payments?.some((item) => item.status === "PAID") ? "payment.collected" : selected.paymentMethod === "DRIVER" ? "payment.toCollect" : selected.paymentMethod === "ONLINE" ? "payment.online" : "payment.unselected")}</p>
            <strong>{money(selected.priceCents, selected.currency)}</strong>
            {receipt?.collectionMethod && <p>{t(`payment.${receipt.collectionMethod}`)}</p>}
            {selected.payments?.some((item) => item.status === "PROCESSING") && <p>{t("payment.processingNotice")}</p>}
            {selected.status === "TRIP_COMPLETED" && !selected.payments?.some((item) => item.status === "PAID") && <fieldset disabled={pending || loading || selected.payments?.some((item) => item.status === "PROCESSING")} className="mt-3 space-y-3">
              <label className="block text-sm">{t("payment.method")}<select className="mt-2 w-full rounded-xl border bg-white p-3 text-slate-900" value={collection?.bookingId === selected.id ? collection.method : ""} onChange={(event) => { const method = z.enum(["CASH", "CARD", "ABA", "OTHER"]).parse(event.target.value); setCollection({ bookingId: selected.id, method }); }}>
                <option value="" disabled>{t("payment.selectMethod")}</option>{(["CASH", "CARD", "ABA", "OTHER"] as const).map((method) => <option value={method} key={method}>{t(`payment.${method}`)}</option>)}
              </select></label>
              {showDriverAbaQr(selected, collection?.bookingId === selected.id ? collection.method : null) && <div className={styles.abaQr}>
                <h5>{t("customer.abaQrTitle")}</h5>
                <p>{t("customer.abaAmount")}: <strong>{localizedNumber(language, { style: "currency", currency: "USD", currencyDisplay: "code" }).format(selected.priceCents / 100)}</strong></p>
                <p>{t("customer.abaReference")}: <strong>{selected.reference}</strong></p>
                <Image src="/aba_mobile_1792486034405.png" alt={t("customer.abaQrAlt")} width={1010} height={1426} unoptimized loading="eager" className={styles.abaQrImage} />
                <div className={styles.abaQrActions}>
                  <a href="/aba_mobile_1792486034405.png" download="saiway-aba-qr.png">{t("customer.downloadQr")}</a>
                  <a href="/aba_mobile_1792486034405.png" target="_blank" rel="noopener noreferrer">{t("customer.openQr")}</a>
                </div>
                <p>{t("payment.driverAbaQrNotice")}</p>
              </div>}
              {selected.paymentMethod === "ONLINE" && <p>{t("payment.onlineCollectionWarning")}</p>}
              <button type="button" className={styles.primaryButton} disabled={collection?.bookingId !== selected.id} onClick={() => void collectPayment(selected, true)}><Wallet size={17} />{t(pending ? "admin.saving" : "payment.collect")}</button>
              <button type="button" className={styles.secondaryButton} onClick={() => void collectPayment(selected, false)}>{t("payment.markUnpaid")}</button>
            </fieldset>}
          </section>}
          {selected.status === "TRIP_STARTED" && !demo && <label className="block p-3 text-sm">{t("auto.observations")}<textarea maxLength={2000} value={observations[selected.id] ?? ""} onChange={(event) => setObservations((current) => ({ ...current, [selected.id]: event.target.value }))} className="mt-2 w-full rounded-xl border p-3" disabled={pending} /></label>}
          {selected.driverObservations && <p className="p-3 text-sm">{t("auto.observations")}: {selected.driverObservations}</p>}
          <div className={styles.actions}>
            {driverNextStatus[selected.status] && <button type="button" className={styles.primaryButton} disabled={pending || loading} onClick={() => void advance(selected)}>{pending ? t("admin.saving") : t(transitionKeys[selected.status as keyof typeof transitionKeys])}<ArrowRight size={18} /></button>}
            {!demo && selected.customer.email && <a className={styles.iconButton} href={`mailto:${selected.customer.email}`} title={t("driver.email")} aria-label={t("driver.email")}><Mail size={19} /></a>}
          </div>
        </> : <div className={styles.emptyMap}><MapPin size={36} /><p>{t("driver.selectTrip")}</p></div>}
      </section>
    </div>

    {!demo && <><VehicleExpenses /><PayrollPanel /></>}
    <DriverLicenseCard />
    <DriverContactQrCard />
    <details className={styles.account}><summary><ShieldCheck size={18} />{t("driver.account")}</summary><ChangePasswordForm /></details>
  </div>;
}