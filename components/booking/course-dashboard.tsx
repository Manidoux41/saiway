"use client";

import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import type { UserRole } from "@/lib/roles";
import type { ManagementData } from "@/lib/admin-client";
import { useLanguage } from "@/components/i18n/language-provider";

export const courseSchema = z.object({
  id: z.string(), reference: z.string(), fromAddress: z.string(), toAddress: z.string(),
  pickupAt: z.string(), passengers: z.number(), luggageCount: z.number(),
  direction: z.string(), tripType: z.string(), priceCents: z.number(), status: z.string(),
  currency: z.string(), flightNumber: z.string().nullable(), pickupNotes: z.string().nullable(), specialNeeds: z.string().nullable(),
  driverId: z.string().nullable(), vehicleId: z.string().nullable(),
  paymentMethod: z.enum(["UNDECIDED", "ONLINE", "DRIVER"]).optional(),
  payments: z.array(z.object({ status: z.string(), provider: z.string(), amountCents: z.number(), currency: z.string() })).optional(),
  customer: z.object({ id: z.string(), name: z.string(), email: z.string() }),
  driver: z.object({ id: z.string(), user: z.object({ name: z.string() }) }).nullable(),
  vehicle: z.object({ id: z.string(), name: z.string(), plate: z.string(), seats: z.number() }).nullable(),
});
export type Course = z.infer<typeof courseSchema>;
const listSchema = z.object({ bookings: z.array(courseSchema) });
const nextStatus: Record<string, string> = { DRIVER_ASSIGNED: "DRIVER_ACCEPTED", DRIVER_ACCEPTED: "DRIVER_EN_ROUTE", DRIVER_EN_ROUTE: "DRIVER_ARRIVED", DRIVER_ARRIVED: "TRIP_STARTED", TRIP_STARTED: "TRIP_COMPLETED" };
const closed = ["CANCELLED", "TRIP_COMPLETED", "NO_SHOW", "REFUNDED"];

export function CourseDashboard({ role, management }: { role: UserRole; management?: ManagementData | null }) {
  const { t } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [creating, setCreating] = useState(false);
  const endpoint = role === "admin" ? "/api/admin/bookings" : role === "driver" ? "/api/driver/bookings" : "/api/bookings";
  const [revision, setRevision] = useState(0);
  function refresh() { setLoading(true); setRevision((value) => value + 1); }
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error(String(response.status));
        const bookings = listSchema.parse(await response.json()).bookings;
        if (!controller.signal.aborted) { setCourses(bookings); setError(""); }
      } catch {
        if (!controller.signal.aborted) setError(t("courses.loadError"));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [endpoint, revision, t]);

  async function mutate(method: string, body: Record<string, unknown>) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) {
        const payload: unknown = await response.json();
        const parsed = z.object({ error: z.string() }).safeParse(payload);
        throw new Error(parsed.success ? parsed.data.error : t("courses.saveError"));
      }
      setEditing(null);
      setCreating(false);
      refresh();
    } catch (error) { setError(`${t("courses.saveError")} ${error instanceof Error ? error.message : ""}`); }
    finally { setPending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    void mutate(editing ? "PATCH" : "POST", {
      ...(editing ? { id: editing.id } : { customerId: value("customerId") }),
      fromAddress: value("fromAddress"), toAddress: value("toAddress"),
      pickupAt: new Date(value("pickupAt")).toISOString(), passengers: Number(value("passengers")),
      luggageCount: Number(value("luggageCount")), priceCents: Math.round(Number(value("price")) * 100),
      direction: value("direction"), tripType: value("tripType"),
      flightNumber: value("flightNumber"), pickupNotes: value("pickupNotes"), specialNeeds: value("specialNeeds"),
      driverId: value("driverId") || null, vehicleId: value("vehicleId") || null,
    });
  }

  const labels = (status: string) => t(status === "DRIVER_ASSIGNED" ? "courses.assigned" : status === "DRIVER_ACCEPTED" ? "courses.accepted" : status === "DRIVER_EN_ROUTE" ? "courses.enRoute" : status === "DRIVER_ARRIVED" ? "courses.arrived" : status === "TRIP_STARTED" ? "courses.started" : status === "TRIP_COMPLETED" ? "courses.completed" : status === "CANCELLED" ? "courses.cancelled" : "courses.pending");
  return <section className="mt-8 space-y-5 rounded-[28px] bg-white p-6 shadow-sm">
    <div className="flex items-center justify-between gap-3"><h2 className="text-xl font-bold">{t(role === "driver" ? "courses.driverTitle" : role === "admin" ? "courses.adminTitle" : "courses.customerTitle")}</h2><button type="button" disabled={pending || loading} onClick={refresh} className="font-semibold underline">{t("admin.retry")}</button>{role === "admin" && <button type="button" disabled={!management || pending} onClick={() => { setCreating(true); setEditing(null); }} className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-white">{t("courses.create")}</button>}</div>
    {error && <p role="alert" className="text-[var(--color-error)]">{error}</p>}
    {loading && <p role="status">{t("admin.loading")}</p>}
    {role === "admin" && management && (creating || editing) && <form key={editing?.id ?? "new"} onSubmit={submit}>
      <fieldset disabled={pending} className="grid gap-4 md:grid-cols-3">
        {!editing && <label>{t("courses.customer")}<select name="customerId" required className="mt-1 w-full rounded-xl border p-3"><option value="">{t("courses.select")}</option>{management.users.filter((user) => user.role === "CUSTOMER" && user.status === "ACTIVE").map((user) => <option key={user.id} value={user.id}>{user.name} · {user.email}</option>)}</select></label>}
        <label>{t("courses.from")}<input name="fromAddress" defaultValue={editing?.fromAddress ?? "SAI Airport"} required className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("courses.to")}<input name="toAddress" defaultValue={editing?.toAddress} required className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("courses.pickup")}<input name="pickupAt" type="datetime-local" defaultValue={editing ? new Date(new Date(editing.pickupAt).getTime() - new Date(editing.pickupAt).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""} required className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("booking.passengers")}<input name="passengers" type="number" min="1" max="50" defaultValue={editing?.passengers ?? 1} required className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("booking.luggageCount")}<input name="luggageCount" type="number" min="0" max="50" defaultValue={editing?.luggageCount ?? 0} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("courses.price")}<input name="price" type="number" min="0" step="0.01" defaultValue={(editing?.priceCents ?? 3500) / 100} required className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("booking.flightNumber")}<input name="flightNumber" defaultValue={editing?.flightNumber ?? ""} maxLength={100} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("booking.notes")}<textarea name="pickupNotes" defaultValue={editing?.pickupNotes ?? ""} maxLength={2000} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("booking.specialNeeds")}<input name="specialNeeds" defaultValue={editing?.specialNeeds ?? ""} maxLength={2000} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("booking.route")}<select name="direction" defaultValue={editing?.direction ?? "AIRPORT_TO_CITY"} className="mt-1 w-full rounded-xl border p-3"><option value="AIRPORT_TO_CITY">{t("courses.airportToCity")}</option><option value="CITY_TO_AIRPORT">{t("courses.cityToAirport")}</option></select></label>
        <label>{t("booking.tripType")}<select name="tripType" defaultValue={editing?.tripType ?? "AIRPORT_TRANSFER"} className="mt-1 w-full rounded-xl border p-3"><option value="AIRPORT_TRANSFER">{t("booking.airportTransfer")}</option><option value="PRIVATE_TRANSFER">{t("booking.privateTransfer")}</option><option value="HOTEL_TRANSFER">{t("booking.hotelTransfer")}</option></select></label>
        <label>{t("admin.driver")}<select name="driverId" defaultValue={editing?.driverId ?? ""} className="mt-1 w-full rounded-xl border p-3"><option value="">{t("courses.unassigned")}</option>{management.users.filter((user) => user.role === "DRIVER" && user.driver && (user.status === "ACTIVE" && user.driver.isAvailable || user.driver.id === editing?.driverId)).map((user) => <option key={user.id} value={user.driver?.id}>{user.name}</option>)}</select></label>
        <label>{t("admin.vehicle")}<select name="vehicleId" defaultValue={editing?.vehicleId ?? ""} className="mt-1 w-full rounded-xl border p-3"><option value="">{t("courses.unassigned")}</option>{management.vehicles.filter((vehicle) => vehicle.active || vehicle.id === editing?.vehicleId).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate} · {vehicle.seats}</option>)}</select></label>
        <button className="rounded-full bg-[var(--color-primary)] p-3 text-white">{t("courses.save")}</button>
        <button type="button" onClick={() => { setEditing(null); setCreating(false); }} className="rounded-full border p-3">{t("booking.back")}</button>
      </fieldset>
    </form>}
    {!loading && !error && courses.length === 0 && <p>{t("courses.empty")}</p>}
    <div className="grid gap-4">{courses.map((course) => <article key={course.id} className="rounded-2xl border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{course.fromAddress} → {course.toAddress}</h3><p>{new Date(course.pickupAt).toLocaleString()} · {course.passengers} {t("booking.passengers")}</p><p className="text-sm text-slate-500">{course.reference}</p></div><p className="font-semibold">{labels(course.status)} · {(course.priceCents / 100).toFixed(2)} {course.currency}</p></div>
      <p className="mt-2">{t("courses.customer")}: {course.customer.name} · {t("admin.driver")}: {course.driver?.user.name ?? t("courses.unassigned")} · {course.vehicle?.plate ?? t("courses.unassigned")}</p>
      <p className="mt-2 text-sm">{t("booking.luggageCount")}: {course.luggageCount}{course.flightNumber && <> · {t("booking.flightNumber")}: {course.flightNumber}</>}</p>
      {course.pickupNotes && <p className="mt-2 whitespace-pre-wrap text-sm">{t("booking.notes")}: {course.pickupNotes}</p>}
      {course.specialNeeds && <p className="mt-2 text-sm">{t("booking.specialNeeds")}: {course.specialNeeds}</p>}
      <div className="mt-3 flex gap-3">
        {role === "admin" && !closed.includes(course.status) && <button type="button" disabled={pending} onClick={() => { setEditing(course); setCreating(false); }} className="font-semibold underline">{t("courses.editAssign")}</button>}
        {role === "driver" && nextStatus[course.status] && <button type="button" disabled={pending} onClick={() => void mutate("PATCH", { id: course.id, status: nextStatus[course.status] })} className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-white">{labels(nextStatus[course.status])}</button>}
        {role !== "driver" && !closed.includes(course.status) && (role === "admin" || ["PENDING_PAYMENT", "CONFIRMED", "DRIVER_ASSIGNMENT_PENDING", "DRIVER_ASSIGNED"].includes(course.status)) && <button type="button" disabled={pending} onClick={() => { if (window.confirm(t("courses.confirmCancel"))) void mutate("DELETE", { id: course.id, status: "CANCELLED" }); }} className="font-semibold text-[var(--color-error)]">{t("courses.cancel")}</button>}
      </div>
    </article>)}</div>
    <p className="text-sm text-slate-500">{t("courses.paymentNotice")}</p>
  </section>;
}
