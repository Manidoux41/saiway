"use client";

import { useRef, useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import { z } from "zod";
import { ArrowRight, CalendarDays, Check, ClipboardCheck, Clock3, Database, Mail, MapPin, Navigation, Pencil, Plus, RefreshCw, Save, Search, Trash2, UserRoundCheck, Users, X } from "lucide-react";
import { courseSchema, type Course } from "@/components/booking/course-dashboard";
import { useBookings } from "@/components/booking/use-bookings";
import { useLanguage } from "@/components/i18n/language-provider";
import type { ManagementData } from "@/lib/admin-client";
import { closedDriverStatuses, driverDay, driverTimeZone, navigationUrl } from "@/lib/driver-dashboard";
import styles from "./admin-dashboard.module.css";

const TripMap = dynamic(() => import("@/components/driver/trip-map"), { ssr: false, loading: () => <div className="h-80 animate-pulse bg-slate-100" /> });
const ongoing = ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"];
const statusKeys = {
  PENDING_PAYMENT: "dispatch.pending", CONFIRMED: "dispatch.confirmed", DRIVER_ASSIGNMENT_PENDING: "dispatch.toAssign", DRIVER_ASSIGNED: "courses.assigned", DRIVER_ACCEPTED: "courses.accepted", DRIVER_EN_ROUTE: "courses.enRoute", DRIVER_ARRIVED: "courses.arrived", TRIP_STARTED: "courses.started", TRIP_COMPLETED: "courses.completed", CANCELLED: "courses.cancelled", NO_SHOW: "driver.noShow", REFUNDED: "driver.refunded",
} as const;
const views = ["all", "toValidate", "toAssign", "ongoing", "history"] as const;
type View = typeof views[number];

function BookingForm({ course, management, courses, pending, onSave, onClose }: { course: Course | null; management: ManagementData; courses: Course[]; pending: boolean; onSave: (body: Record<string, unknown>) => void; onClose: () => void }) {
  const { t } = useLanguage();
  const [passengers, setPassengers] = useState(course?.passengers ?? 1);
  const customers = management.users.filter((user) => user.role === "CUSTOMER" && user.status === "ACTIVE");
  const drivers = management.users.filter((user) => user.driver && user.role === "DRIVER" && (user.status === "ACTIVE" && user.driver.isAvailable || user.driver.id === course?.driverId));
  const vehicles = management.vehicles.filter((vehicle) => vehicle.active || vehicle.id === course?.vehicleId);
  const locked = Boolean(course && ongoing.includes(course.status));
  const unpaid = !course?.payments?.some((payment) => payment.status === "PAID");
  const pickupValue = course ? new Date(Date.parse(course.pickupAt) + 7 * 3_600_000).toISOString().slice(0, 16) : "";

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) ?? "");
    const pickup = new Date(`${value("pickupAt")}:00+07:00`);
    if (!Number.isFinite(pickup.getTime())) return;
    onSave({
      ...(course ? { id: course.id } : { customerId: value("customerId") }),
      fromAddress: value("fromAddress"), toAddress: value("toAddress"), pickupAt: pickup.toISOString(),
      passengers, luggageCount: Number(value("luggageCount")), priceCents: Math.round(Number(value("price")) * 100),
      direction: value("direction"), tripType: value("tripType"), flightNumber: value("flightNumber"), pickupNotes: value("pickupNotes"), specialNeeds: value("specialNeeds"),
      driverId: locked ? course?.driverId : value("driverId") || null,
      vehicleId: locked ? course?.vehicleId : value("vehicleId") || null,
    });
  }

  return <section className={styles.editor} aria-label={t(course ? "dispatch.edit" : "dispatch.new")}>
    <div className={styles.sectionHeading}><h2>{t(course ? "dispatch.edit" : "dispatch.new")}</h2><button type="button" className={styles.iconButton} onClick={onClose} disabled={pending} title={t("dispatch.close")} aria-label={t("dispatch.close")}><X size={18} /></button></div>
    {!course && !customers.length && <p role="alert" className={styles.warning}>{t("dispatch.noCustomers")}</p>}
    <form onSubmit={submit}><fieldset disabled={pending || !course && !customers.length} className={styles.formGrid}>
      {!course && <label className={styles.wide}>{t("courses.customer")}<select name="customerId" required defaultValue=""><option value="">{t("courses.select")}</option>{customers.map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label>}
      <label>{t("courses.from")}<input name="fromAddress" required maxLength={500} defaultValue={course?.fromAddress ?? "SAI Airport"} /></label>
      <label>{t("courses.to")}<input name="toAddress" required maxLength={500} defaultValue={course?.toAddress ?? ""} /></label>
      <label>{t("courses.pickup")}<input name="pickupAt" type="datetime-local" required defaultValue={pickupValue} /><small>{t("dispatch.dateHelp")}</small></label>
      <label>{t("dispatch.price")} ({course?.currency ?? "USD"})<input name="price" type="number" required readOnly={!unpaid} min="0" max="1000000" step="0.01" defaultValue={(course?.priceCents ?? 3500) / 100} /></label>
      <label>{t("booking.passengers")}<input name="passengers" type="number" required min="1" max="50" value={passengers} onChange={(event) => setPassengers(Number(event.target.value))} /></label>
      <label>{t("booking.luggageCount")}<input name="luggageCount" type="number" required min="0" max="50" defaultValue={course?.luggageCount ?? 0} /></label>
      <label>{t("booking.route")}<select name="direction" defaultValue={course?.direction ?? "AIRPORT_TO_CITY"}><option value="AIRPORT_TO_CITY">{t("courses.airportToCity")}</option><option value="CITY_TO_AIRPORT">{t("courses.cityToAirport")}</option></select></label>
      <label>{t("booking.tripType")}<select name="tripType" defaultValue={course?.tripType ?? "AIRPORT_TRANSFER"}><option value="AIRPORT_TRANSFER">{t("booking.airportTransfer")}</option><option value="PRIVATE_TRANSFER">{t("booking.privateTransfer")}</option><option value="HOTEL_TRANSFER">{t("booking.hotelTransfer")}</option></select></label>
      <h3 className={styles.wide}>{t("dispatch.assignment")}</h3>
      <label>{t("admin.driver")}<select name="driverId" disabled={locked} defaultValue={course?.driverId ?? ""}><option value="">{t("courses.unassigned")}</option>{drivers.map((user) => <option key={user.id} value={user.driver!.id}>{user.name} · {courses.filter((item) => item.driverId === user.driver!.id && !closedDriverStatuses.includes(item.status)).length} {t("dispatch.assignedTrips")}</option>)}</select></label>
      <label>{t("admin.vehicle")}<select name="vehicleId" disabled={locked} defaultValue={course?.vehicleId ?? ""}><option value="">{t("courses.unassigned")}</option>{vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id} disabled={!vehicle.active || vehicle.seats < passengers}>{vehicle.name} · {vehicle.plate} · {vehicle.seats} {t("records.seats")}</option>)}</select></label>
      {locked && <p className={`${styles.warning} ${styles.wide}`}>{t("dispatch.assignmentLocked")}</p>}
      {!drivers.length && <p className={`${styles.warning} ${styles.wide}`}>{t("dispatch.noDrivers")}</p>}
      {!vehicles.some((vehicle) => vehicle.active && vehicle.seats >= passengers) && <p className={`${styles.warning} ${styles.wide}`}>{t("dispatch.noVehicle")}</p>}
      <label>{t("booking.flightNumber")}<input name="flightNumber" maxLength={100} defaultValue={course?.flightNumber ?? ""} /></label>
      <label>{t("booking.specialNeeds")}<input name="specialNeeds" maxLength={2000} defaultValue={course?.specialNeeds ?? ""} /></label>
      <label className={styles.wide}>{t("booking.notes")}<textarea name="pickupNotes" rows={2} maxLength={2000} defaultValue={course?.pickupNotes ?? ""} /></label>
      <div className={`${styles.formActions} ${styles.wide}`}><button type="submit" className={styles.primaryButton}><Save size={17} />{t(pending ? "admin.saving" : "dispatch.save")}</button><button type="button" className={styles.secondaryButton} onClick={onClose}>{t("booking.back")}</button></div>
    </fieldset></form>
  </section>;
}

export function AdminBookings({ management, disabled }: { management: ManagementData | null; disabled: boolean }) {
  const { t, language } = useLanguage();
  const [pending, setPending] = useState(false);
  const mutationLock = useRef(false);
  const { courses, setCourses, loading, loaded, error, refresh, lastUpdated } = useBookings("/api/admin/bookings", pending);
  const [mutationError, setMutationError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState<View>("all");
  const [query, setQuery] = useState("");
  const [driverId, setDriverId] = useState("");
  const [date, setDate] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<Course | "new" | null>(null);
  const editSection = useRef<HTMLDivElement>(null);
  const closed = (course: Course) => closedDriverStatuses.includes(course.status);
  const matchesView = (course: Course, value: View) => value === "all" || (value === "history" ? closed(course) : value === "toValidate" ? course.status === "PENDING_PAYMENT" : value === "toAssign" ? !closed(course) && !course.driverId : ongoing.includes(course.status));
  const search = query.trim().toLocaleLowerCase();
  const visible = courses.filter((course) => matchesView(course, view) && (!driverId || course.driverId === driverId) && (!date || driverDay(course.pickupAt) === date) && (!search || [course.reference, course.customer.name, course.customer.email, course.fromAddress, course.toAddress, course.flightNumber ?? ""].join(" ").toLocaleLowerCase().includes(search)));
  const selected = visible.find((course) => course.id === selectedId) ?? visible[0];
  const receipt = selected?.payments?.find((item) => item.status === "PAID");
  const statusLabel = (status: string) => t(statusKeys[status as keyof typeof statusKeys] ?? "courses.pending");
  const time = (value: string | Date, options: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) => new Intl.DateTimeFormat(language, { ...options, timeZone: driverTimeZone }).format(new Date(value));
  const money = (course: Course) => new Intl.NumberFormat(language, { style: "currency", currency: course.currency }).format(course.priceCents / 100);

  function openEditor(course: Course | "new") {
    setEditor(course); setMutationError(""); setMessage("");
    requestAnimationFrame(() => editSection.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function mutate(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>) {
    if (mutationLock.current || disabled || loading || error) return;
    mutationLock.current = true; setPending(true); setMutationError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/bookings", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error("Booking update failed");
      const result = z.object({ booking: courseSchema }).parse(await response.json());
      setCourses((current) => [...current.filter((course) => course.id !== result.booking.id), result.booking].sort((first, second) => Date.parse(first.pickupAt) - Date.parse(second.pickupAt)));
      setSelectedId(result.booking.id); setEditor(null); setMessage(t("dispatch.saved"));
      setView(method === "DELETE" ? "history" : "all"); setQuery(""); setDriverId(""); setDate("");
    } catch { setMutationError(t("dispatch.failed")); }
    finally { mutationLock.current = false; setPending(false); }
  }

  const blocked = pending || disabled || loading || Boolean(error);
  return <div>
    <div className={styles.toolbar}><div><p className={styles.database}><Database size={15} />{t("dispatch.database")}</p><p className={styles.muted}>{lastUpdated ? `${t("dispatch.synced")} ${time(lastUpdated, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : t("admin.loading")}</p></div><div className={styles.toolbarActions}><button type="button" className={styles.iconButton} disabled={pending || loading} onClick={refresh} title={t("driver.refresh")} aria-label={t("driver.refresh")}><RefreshCw size={18} className={loading ? "animate-spin" : ""} /></button><button type="button" className={styles.primaryButton} disabled={!management || blocked} onClick={() => openEditor("new")}><Plus size={18} />{t("dispatch.new")}</button></div></div>
    {(error || mutationError) && <p role="alert" className={styles.error}>{error || mutationError}</p>}
    {message && <p role="status" className={styles.success}><Check size={17} />{message}</p>}
    <section className={styles.metrics} aria-label={t("dispatch.operations")}>
      {[
        { key: "today", label: t("dispatch.today"), count: courses.filter((course) => driverDay(course.pickupAt) === driverDay(new Date()) && !["CANCELLED", "REFUNDED", "NO_SHOW"].includes(course.status)).length, icon: CalendarDays, onClick: () => { setView("all"); setDate(driverDay(new Date())); } },
        { key: "toValidate", label: t("dispatch.toValidate"), count: courses.filter((course) => matchesView(course, "toValidate")).length, icon: ClipboardCheck, onClick: () => { setView("toValidate"); setDate(""); } },
        { key: "toAssign", label: t("dispatch.toAssign"), count: courses.filter((course) => matchesView(course, "toAssign")).length, icon: UserRoundCheck, onClick: () => { setView("toAssign"); setDate(""); } },
        { key: "ongoing", label: t("dispatch.ongoing"), count: courses.filter((course) => matchesView(course, "ongoing")).length, icon: Navigation, onClick: () => { setView("ongoing"); setDate(""); } },
      ].map(({ key, label, count, icon: Icon, onClick }) => <button type="button" key={key} onClick={() => { onClick(); setQuery(""); setDriverId(""); }}><span><Icon size={17} />{label}</span><strong>{loaded ? count : "…"}</strong><ArrowRight size={16} /></button>)}
    </section>
    <div ref={editSection} className={styles.editorAnchor}>{editor && management && <BookingForm key={editor === "new" ? "new" : editor.id} course={editor === "new" ? null : editor} management={management} courses={courses} pending={pending || disabled || Boolean(error)} onSave={(body) => void mutate(editor === "new" ? "POST" : "PATCH", body)} onClose={() => setEditor(null)} />}</div>
    <div className={styles.workspace}>
      <section className={styles.schedule} aria-busy={loading}>
        <div className={styles.sectionHeading}><h2>{t("courses.adminTitle")}</h2><span className={styles.muted}>{visible.length} {t("dispatch.results")}</span></div>
        <div className={styles.views} role="group" aria-label={t("courses.adminTitle")}>{views.map((value) => <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)}>{t(`dispatch.${value}`)}</button>)}</div>
        <div className={styles.filters}><label className={styles.search}><Search size={17} /><input type="search" aria-label={t("dispatch.search")} placeholder={t("dispatch.search")} value={query} onChange={(event) => setQuery(event.target.value)} /></label><select aria-label={t("dispatch.allDrivers")} value={driverId} onChange={(event) => setDriverId(event.target.value)}><option value="">{t("dispatch.allDrivers")}</option>{management?.users.filter((user) => user.role === "DRIVER" && user.driver).map((user) => <option key={user.id} value={user.driver!.id}>{user.name}</option>)}</select><input type="date" aria-label={t("dispatch.allDates")} value={date} onChange={(event) => setDate(event.target.value)} /><button type="button" className={styles.iconButton} onClick={() => { setQuery(""); setDriverId(""); setDate(""); setView("all"); }} title={t("dispatch.clear")} aria-label={t("dispatch.clear")}><X size={16} /></button></div>
        <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>{t("booking.route")}</th><th>{t("courses.customer")}</th><th>{t("admin.driver")}</th><th>{t("records.status")}</th></tr></thead><tbody>{visible.map((course) => <tr key={course.id} data-selected={selected?.id === course.id}><td><button type="button" className={styles.routeButton} onClick={() => setSelectedId(course.id)} aria-pressed={selected?.id === course.id}><small>{time(course.pickupAt)} · {course.reference}</small><strong>{course.fromAddress}</strong><span><ArrowRight size={13} />{course.toAddress}</span><small className={styles.mobileMeta}>{course.customer.name} · {money(course)}</small></button></td><td className={styles.customerCell}><strong>{course.customer.name}</strong><small><Users size={12} />{course.passengers} · {money(course)}</small></td><td className={styles.driverCell}>{course.driver?.user.name ?? t("courses.unassigned")}<small>{course.vehicle?.plate ?? "—"}</small></td><td><span className={styles.badge} data-status={course.status}>{statusLabel(course.status)}</span></td></tr>)}</tbody></table></div>
        {!loading && !visible.length && <p className={styles.empty}>{t("courses.empty")}</p>}
        {loading && !loaded && <p role="status" className={styles.empty}>{t("admin.loading")}</p>}
        <p className={styles.footnote}>{t("dispatch.syncNote")}</p><p className={styles.footnote}>{t("dispatch.demoNote")}</p>
      </section>
      <section className={styles.inspector} aria-label={t("driver.selected")}>
        {selected ? <>
          <div className={styles.sectionHeading}><h2>{t("driver.selected")}</h2><a href={navigationUrl(selected)} target="_blank" rel="noopener noreferrer" className={styles.iconButton} title={t("driver.navigate")} aria-label={t("driver.navigate")}><Navigation size={18} /></a></div>
          <div className={styles.mapFrame}><TripMap key={`${selected.id}-${selected.fromAddress}-${selected.toAddress}-${language}`} course={selected} demo={false} /></div>
          <div className={styles.detailHeading}><div><small>{selected.reference}</small><h3>{selected.customer.name}</h3></div><span className={styles.badge} data-status={selected.status}>{statusLabel(selected.status)}</span></div>
          <div className={styles.routeDetail}><MapPin size={17} /><div><p>{selected.fromAddress}</p><ArrowRight size={14} /><p>{selected.toAddress}</p></div></div>
          <dl className={styles.facts}><div><dt>{t("courses.pickup")}</dt><dd>{time(selected.pickupAt)}</dd></div><div><dt>{t("booking.flightNumber")}</dt><dd>{selected.flightNumber ?? "—"}</dd></div><div><dt>{t("booking.passengers")}</dt><dd>{selected.passengers} · {selected.luggageCount} {t("booking.luggage")}</dd></div><div><dt>{t("dispatch.price")}</dt><dd>{money(selected)}</dd></div><div><dt>{t("admin.driver")}</dt><dd>{selected.driver?.user.name ?? t("courses.unassigned")}</dd></div><div><dt>{t("booking.vehicle")}</dt><dd>{selected.vehicle ? `${selected.vehicle.name} · ${selected.vehicle.plate}` : t("courses.unassigned")}</dd></div></dl>
          {selected.pickupNotes && <div className={styles.notes}><h4>{t("booking.notes")}</h4><p>{selected.pickupNotes}</p></div>}
          <dl className={styles.facts}><div><dt>{t("payment.method")}</dt><dd>{t(selected.paymentMethod === "DRIVER" ? "payment.atDriver" : selected.paymentMethod === "ONLINE" ? "payment.online" : "payment.unselected")}</dd></div><div><dt>{t("customer.paymentLabel")}</dt><dd>{t(receipt ? "payment.collected" : selected.paymentMethod === "DRIVER" ? "payment.toCollect" : "customer.noPayment")}</dd></div>{receipt && <div><dt>{t("payment.receivedVia")}</dt><dd>{receipt.collectionMethod ? t(`payment.${receipt.collectionMethod}`) : receipt.provider === "ABA_PAYWAY" ? t("payment.ABA") : t("payment.legacyMethod")}</dd></div>}</dl>
          {selected.specialNeeds && <div className={styles.warning}><h4>{t("booking.specialNeeds")}</h4><p>{selected.specialNeeds}</p></div>}
          <div className={styles.detailActions}>
            {selected.status === "PENDING_PAYMENT" && <button type="button" className={styles.primaryButton} disabled={blocked} onClick={() => { if (window.confirm(t("dispatch.confirmNotice"))) void mutate("PATCH", { id: selected.id, status: "CONFIRMED" }); }}><ClipboardCheck size={17} />{t("dispatch.validate")}</button>}
            {!closed(selected) && <button type="button" className={styles.secondaryButton} disabled={!management || blocked} onClick={() => openEditor(selected)}>{selected.driverId ? <Pencil size={16} /> : <UserRoundCheck size={16} />}{t(selected.driverId ? "dispatch.edit" : "dispatch.assign")}</button>}
            <a className={styles.iconButton} href={`mailto:${selected.customer.email}`} aria-label={t("driver.email")} title={t("driver.email")}><Mail size={17} /></a>
            {!closed(selected) && <button type="button" className={styles.dangerButton} disabled={blocked} aria-label={t("courses.cancel")} title={t("courses.cancel")} onClick={() => { if (window.confirm(t("courses.confirmCancel"))) void mutate("DELETE", { id: selected.id, status: "CANCELLED" }); }}><Trash2 size={17} /></button>}
          </div>
          <p className={styles.footnote}>{t("dispatch.paymentNote")}</p><p className={styles.footnote}>{t("driver.mapPrivacy")}</p>
        </> : <div className={styles.emptyInspector}><Clock3 size={30} /><p>{t("dispatch.select")}</p></div>}
      </section>
    </div>
    <section className={styles.driverSchedule}><h2>{t("dispatch.driverLoad")}</h2><div>{management?.users.filter((user) => user.role === "DRIVER" && user.driver && user.status === "ACTIVE").map((user) => { const assigned = courses.filter((course) => course.driverId === user.driver!.id && !closed(course)); return <button key={user.id} type="button" aria-pressed={driverId === user.driver!.id} onClick={() => { setDriverId(user.driver!.id); setView("all"); setDate(""); setQuery(""); }}><span className={styles.availability} data-available={user.driver!.isAvailable} /><strong>{user.name}</strong><span>{assigned.length} {t("dispatch.assignedTrips")}</span></button>; })}</div></section>
  </div>;
}