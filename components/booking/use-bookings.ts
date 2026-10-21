"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";
import { courseSchema, type Course } from "@/components/booking/course-dashboard";
import { useLanguage } from "@/components/i18n/language-provider";

const bookingsSchema = z.object({ bookings: z.array(courseSchema) });

export function useBookings(endpoint: "/api/admin/bookings" | "/api/driver/bookings" | "/api/bookings", paused = false) {
  const { t } = useLanguage();
  const [courses, setCourses] = useState<Course[]>([]);
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
    inFlight.current = true;
    async function load() {
      let failureKey: "courses.loadUnavailable" | "courses.sessionExpired" | "courses.invalidResponse" = "courses.loadUnavailable";
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]);
      try {
        const response = await fetch(endpoint, { cache: "no-store", signal });
        if (response.status === 401 || response.status === 403) failureKey = "courses.sessionExpired";
        if (!response.ok) throw new Error("Bookings unavailable");
        failureKey = "courses.invalidResponse";
        const result = bookingsSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setCourses(result.bookings); setLoaded(true); setLastUpdated(new Date()); setError("");
      } catch {
        if (!controller.signal.aborted) setError(t(signal.aborted ? "courses.loadTimeout" : failureKey));
      } finally {
        if (!controller.signal.aborted) { inFlight.current = false; setLoading(false); }
      }
    }
    void load();
    return () => { controller.abort(); inFlight.current = false; };
  }, [endpoint, revision, paused, t]);

  return { courses, setCourses, loaded, loading, error, setError, refresh, lastUpdated };
}