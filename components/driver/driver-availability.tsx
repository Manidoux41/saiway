"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useLanguage } from "@/components/i18n/language-provider";
import { driverAvailabilitySchema, type DriverAvailabilityState } from "@/lib/driver-availability-client";
import styles from "./driver-dashboard.module.css";

const optionsSchema = z.object({ vehicles: z.array(z.object({ id: z.string(), name: z.string(), plate: z.string(), seats: z.number() })) });
const savedSchema = z.object({ driverAvailability: driverAvailabilitySchema });

export function DriverAvailability({ value, inService, disabled, onSaved, onPending }: {
  value: DriverAvailabilityState | null; inService: boolean; disabled: boolean;
  onSaved: (value: DriverAvailabilityState) => void; onPending: (pending: boolean) => void;
}) {
  const { t } = useLanguage();
  const [vehicles, setVehicles] = useState<z.infer<typeof optionsSchema>["vehicles"]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [revision, setRevision] = useState(0);
  const lock = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/driver/availability", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (!response.ok) throw new Error("Availability options unavailable");
        const result = optionsSchema.parse(await response.json());
        if (!controller.signal.aborted) { setVehicles(result.vehicles); setReady(true); setError(""); }
      } catch { if (!controller.signal.aborted) { setReady(false); setError(t("driver.availabilityError")); } }
    }
    void load();
    return () => controller.abort();
  }, [revision, t]);

  async function save(isAvailable: boolean, selectedVehicleId: string | null) {
    if (!value || disabled || lock.current) return;
    if (isAvailable && !selectedVehicleId) { setError(t("driver.selectAvailabilityVehicle")); return; }
    lock.current = true; onPending(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/driver/availability", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAvailable, selectedVehicleId }), signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        const failure = z.object({ error: z.string() }).parse(await response.json());
        setError(t(failure.error === "Vehicle selected by another available driver" ? "driver.availabilityVehicleBusy" : failure.error === "Finish the current trip before changing vehicle" ? "driver.availabilityVehicleLocked" : failure.error === "Select an active vehicle" ? "driver.selectAvailabilityVehicle" : "driver.availabilityError"));
        return;
      }
      onSaved(savedSchema.parse(await response.json()).driverAvailability);
      setMessage(t("driver.availabilitySaved"));
    } catch { setError(t("driver.availabilityError")); }
    finally { lock.current = false; onPending(false); }
  }

  const missingSelected = value?.selectedVehicleId && !vehicles.some((vehicle) => vehicle.id === value.selectedVehicleId);
  return <section className={styles.availability} aria-label={t("driver.availabilityTitle")}>
    <div className={styles.availabilityTop}>
      <div><h2>{t("driver.availabilityTitle")}</h2><strong role="status">{t(!value ? "admin.loading" : inService ? "driver.inService" : value.isAvailable ? "driver.available" : "driver.unavailable")}</strong></div>
      <button type="button" role="switch" aria-checked={value?.isAvailable ?? false} aria-label={t("driver.availabilitySwitch")}
        className={styles.availabilitySwitch} disabled={disabled || !ready || !value} onClick={() => void save(!value?.isAvailable, value?.selectedVehicleId ?? null)}><span /></button>
    </div>
    <label>{t("driver.availabilityVehicle")}
      <select value={value?.selectedVehicleId ?? ""} disabled={disabled || !ready || !value || inService} onChange={(event) => void save(value?.isAvailable ?? false, event.target.value || null)}>
        <option value="">{t("driver.selectAvailabilityVehicle")}</option>
        {missingSelected && <option value={value?.selectedVehicleId ?? ""} disabled>{t("driver.availabilityVehicleInactive")}</option>}
        {vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate} · {vehicle.seats} {t("records.seats")}</option>)}
      </select>
    </label>
    <p>{t("driver.availabilityHelp")}</p>
    {inService && <p>{t("driver.availabilityInServiceHelp")}</p>}
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {!ready && error && <button type="button" className={styles.iconButton} onClick={() => setRevision((current) => current + 1)}>{t("live.retry")}</button>}
    {message && <p role="status" className={styles.success}>{message}</p>}
  </section>;
}
