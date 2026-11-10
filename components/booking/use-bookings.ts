"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { courseSchema, type Course } from "@/components/booking/course-dashboard";
import { useLanguage } from "@/components/i18n/language-provider";
import { driverAvailabilitySchema, type DriverAvailabilityState } from "@/lib/driver-availability-client";

const bookingsSchema = z.object({ bookings: z.array(courseSchema), driverAvailability: driverAvailabilitySchema.optional() });

export function useBookings(endpoint: "/api/admin/bookings" | "/api/driver/bookings" | "/api/bookings", paused = false, archived = false) {
  const { t } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
  const [driverAvailability, setDriverAvailability] = useState<DriverAvailabilityState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const inFlight = useRef(false);
  const refresh = useCallback(() => { setLoading(true); setRevision((current) => current + 1); }, []);

  useEffect(() => {
    if (paused) return;
    function sync() { if (document.visibilityState === "visible" && !inFlight.current) setRevision((current) => current + 1); }
    const timer = window.setInterval(sync, 15_000);
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", sync); document.removeEventListener("visibilitychange", sync); };
  }, [paused]);

  useEffect(() => {
    if (paused) return;
    const controller = new AbortController();
    const url = endpoint === "/api/admin/bookings" && archived ? `${endpoint}?archived=true` : endpoint;
    inFlight.current = true;
    async function load() {
      let failureKey: "courses.loadUnavailable" | "courses.sessionExpired" | "courses.invalidResponse" = "courses.loadUnavailable";
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
      try {
        const response = await fetch(url, { cache: "no-store", signal });
        if (response.status === 401 || response.status === 403) failureKey = "courses.sessionExpired";
        if (!response.ok) throw new Error("Bookings unavailable");
        failureKey = "courses.invalidResponse";
        const result = bookingsSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setCourses(result.bookings); setLoaded(true); setLastUpdated(new Date()); setError("");
        if (result.driverAvailability) setDriverAvailability(result.driverAvailability);
      } catch {
        if (!controller.signal.aborted) setError(t(signal.aborted ? "courses.loadTimeout" : failureKey));
      } finally {
        if (!controller.signal.aborted) { inFlight.current = false; setLoading(false); }
      }
    }
    void load();
    return () => { controller.abort(); inFlight.current = false; };
  }, [endpoint, revision, paused, t, archived]);

  return { courses: endpoint === "/api/admin/bookings" ? courses.filter((course) => Boolean(course.adminArchivedAt) === archived) : courses, setCourses, loaded, loading, error, setError, refresh, lastUpdated, driverAvailability, setDriverAvailability };
}