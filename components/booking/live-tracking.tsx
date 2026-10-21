"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { z } from "zod";
import { Car, Clock3, Crosshair, LocateFixed, LocateOff, MapPin, Navigation, Route } from "lucide-react";
import { useBookings } from "@/components/booking/use-bookings";
import { useLanguage } from "@/components/i18n/language-provider";
import { distanceMeters } from "@/components/driver/use-location-sharing";
import type { LivePoint } from "./live-tracking-map";
import styles from "./live-tracking.module.css";

const LiveTrackingMap = dynamic(() => import("./live-tracking-map"), { ssr: false, loading: () => <div className="h-[420px] animate-pulse bg-slate-100 sm:h-[520px]" /> });
const trackingStatuses = ["DRIVER_EN_ROUTE", "DRIVER_ARRIVED", "TRIP_STARTED"];
const followable = ["DRIVER_ASSIGNED", "DRIVER_ACCEPTED", ...trackingStatuses];
const closedStatuses = ["TRIP_COMPLETED", "CANCELLED", "NO_SHOW", "REFUNDED"];
const statusKeys = {
  DRIVER_ASSIGNED: "courses.assigned", DRIVER_ACCEPTED: "courses.accepted", DRIVER_EN_ROUTE: "courses.enRoute", DRIVER_ARRIVED: "courses.arrived", TRIP_STARTED: "courses.started", TRIP_COMPLETED: "courses.completed", CANCELLED: "courses.cancelled",
} as const;
const pollMs = 4_000;
const staleMs = 60_000;
const liveSchema = z.object({
  booking: z.object({ id: z.string(), status: z.string(), driverName: z.string().nullable(), vehicle: z.object({ name: z.string(), plate: z.string() }).nullable() }),
  tracking: z.boolean(),
  location: z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().nullable(), recordedAt: z.string() }).nullable(),
});
type Live = z.infer<typeof liveSchema>;
type MyPosition = { phase: "locating" | "ready" | "denied" | "unavailable"; point: LivePoint | null };

export function LiveTracking() {
  const { t, language } = useLanguage();
  const requested = useSearchParams().get("booking");
  const { courses, loaded, error: listError } = useBookings("/api/bookings");
  const [chosen, setChosen] = useState<string | null>(requested);
  const [live, setLive] = useState<{ bookingId: string; data: Live | null; failed: boolean } | null>(null);
  const [me, setMe] = useState<MyPosition>({ phase: "locating", point: null });
  const [now, setNow] = useState(() => Date.now());
  const [recenter, setRecenter] = useState(0);

  const candidates = courses.filter((course) => followable.includes(course.status))
    .sort((a, b) => Number(trackingStatuses.includes(b.status)) - Number(trackingStatuses.includes(a.status)) || a.pickupAt.localeCompare(b.pickupAt));
  const course = courses.find((item) => item.id === chosen) ?? candidates[0];
  const courseId = course?.id ?? null;
  const current = live?.bookingId === courseId ? live : null;
  const status = current?.data?.booking.status ?? course?.status ?? "";
  const driverPoint = current?.data?.location ?? null;
  const age = driverPoint ? Math.max(0, now - new Date(driverPoint.recordedAt).getTime()) : null;
  const vehicle = current?.data?.booking.vehicle ?? course?.vehicle ?? null;
  const gap = driverPoint && me.point ? distanceMeters(driverPoint, me.point) : null;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      void Promise.resolve().then(() => setMe({ phase: "unavailable", point: null }));
      return;
    }
    const watch = navigator.geolocation.watchPosition(
      (position) => setMe({ phase: "ready", point: { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null } }),
      (failure) => setMe((previous) => ({ phase: failure.code === failure.PERMISSION_DENIED ? "denied" : previous.point ? previous.phase : "unavailable", point: failure.code === failure.PERMISSION_DENIED ? null : previous.point })),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 30_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, []);

  useEffect(() => {
    if (!courseId) return;
    let active = true;
    let busy = false;
    const id = courseId;
    async function poll() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch(`/api/bookings/${encodeURIComponent(id)}/location`, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error("Location unavailable");
        const data = liveSchema.parse(await response.json());
        if (active) setLive({ bookingId: id, data, failed: false });
      } catch {
        if (active) setLive((previous) => ({ bookingId: id, data: previous?.bookingId === id ? previous.data : null, failed: true }));
      } finally { busy = false; }
    }
    void poll();
    const timer = window.setInterval(poll, pollMs);
    document.addEventListener("visibilitychange", poll);
    return () => { active = false; window.clearInterval(timer); document.removeEventListener("visibilitychange", poll); };
  }, [courseId]);

  const statusLabel = (value: string) => t(statusKeys[value as keyof typeof statusKeys] ?? "courses.pending");
  const distance = (meters: number) => meters < 1000 ? `${Math.round(meters)} m` : `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;

  return <div className={styles.page}>
    <header className={styles.heading}>
      <p className={styles.eyebrow}><span className={styles.liveDot} aria-hidden="true" />{t("live.eyebrow")}</p>
      <h1>{t("live.title")}</h1>
      <p>{t("live.intro")}</p>
    </header>

    {listError && <p role="alert" className={styles.alert}>{listError}</p>}
    {!loaded && !listError && <div className={styles.skeleton} role="status" aria-label={t("admin.loading")} />}
    {loaded && !course && <section className={styles.empty}><Car size={28} aria-hidden="true" /><p>{t("live.noTrip")}</p><Link href="/account" className={styles.button}>{t("live.myTrips")}</Link></section>}

    {course && <div className={styles.layout}>
      <section className={styles.panel} aria-live="polite">
        {candidates.length > 1 && <label className={styles.picker}><span>{t("live.trip")}</span><select value={course.id} onChange={(event) => setChosen(event.target.value)}>{candidates.map((item) => <option key={item.id} value={item.id}>{item.reference} · {new Intl.DateTimeFormat(language, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Phnom_Penh" }).format(new Date(item.pickupAt))}</option>)}</select></label>}
        <div className={styles.statusRow}><span className={styles.badge} data-live={trackingStatuses.includes(status)}>{statusLabel(status)}</span><small>{course.reference}</small></div>
        <div className={styles.driverCard}>
          <span className={styles.driverAvatar} aria-hidden="true"><Car size={22} /></span>
          <div><small>{t("live.driver")}</small><strong>{current?.data?.booking.driverName ?? course.driver?.user.name ?? "—"}</strong>{vehicle && <span>{vehicle.name} · {vehicle.plate}</span>}</div>
        </div>
        <ul className={styles.route}><li><MapPin size={17} className="text-[var(--color-primary)]" aria-hidden="true" /><span><small>{t("track.pickup")}</small>{course.fromAddress}</span></li><li><MapPin size={17} className="text-[var(--color-accent)]" aria-hidden="true" /><span><small>{t("track.destination")}</small>{course.toAddress}</span></li></ul>

        {closedStatuses.includes(status) && <p className={styles.info}>{t("live.ended")}</p>}
        {["DRIVER_ASSIGNED", "DRIVER_ACCEPTED"].includes(status) && <p className={styles.info}><Navigation size={17} aria-hidden="true" />{t("live.waiting")}</p>}
        {trackingStatuses.includes(status) && !driverPoint && !current?.failed && <p className={styles.info}><Clock3 size={17} aria-hidden="true" />{t("live.noSignal")}</p>}
        {current?.failed && <p role="alert" className={styles.alert}>{t("live.loadError")}</p>}

        {driverPoint && age !== null && <dl className={styles.metrics}>
          <div><dt><Clock3 size={15} aria-hidden="true" />{t("live.eyebrow")}</dt><dd>{t("live.updated").replace("{seconds}", String(Math.round(age / 1000)))}</dd></div>
          {gap !== null && <div><dt><Route size={15} aria-hidden="true" />{t("live.distance")}</dt><dd>{distance(gap)}</dd></div>}
        </dl>}
        {driverPoint && age !== null && age > staleMs && <p role="status" className={styles.warning}>{t("live.stale")}</p>}

        <p className={styles.myPosition} data-phase={me.phase}>{me.phase === "ready" ? <LocateFixed size={16} aria-hidden="true" /> : <LocateOff size={16} aria-hidden="true" />}{me.phase === "ready" ? t("live.you") : t(me.phase === "locating" ? "live.myLocating" : me.phase === "denied" ? "live.myDenied" : "live.myUnavailable")}</p>
        <p className={styles.privacy}>{t("live.privacy")}</p>
      </section>

      <section className={styles.mapCard}>
        <LiveTrackingMap key={course.id} fromAddress={course.fromAddress} toAddress={course.toAddress} driver={trackingStatuses.includes(status) ? driverPoint : null} me={me.point} recenter={recenter}
          labels={{ map: t("live.title"), driver: t("live.driver"), you: t("live.you"), pickup: t("track.pickup"), destination: t("track.destination"), tiles: t("driver.mapTilesError") }} />
        <button type="button" className={styles.recenter} onClick={() => setRecenter((value) => value + 1)}><Crosshair size={17} aria-hidden="true" />{t("live.recenter")}</button>
      </section>
    </div>}
  </div>;
}
