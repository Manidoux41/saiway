"use client";

import { useCallback, useEffect, useState } from "react";
import { z } from "zod";
import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { FleetMap, type FleetDriver, type FleetHub } from "@/components/maps/fleet-map";
import styles from "./admin-dashboard.module.css";

const fleetSchema = z.object({
  hubs: z.array(z.object({ id: z.string(), name: z.string(), address: z.string().nullable(), latitude: z.number(), longitude: z.number() })),
  drivers: z.array(z.object({
    id: z.string(), name: z.string(), status: z.enum(["AVAILABLE", "ASSIGNED", "TO_PICKUP", "ON_TRIP", "RETURNING_TO_HUB"]),
    location: z.object({ latitude: z.number(), longitude: z.number(), accuracy: z.number().nullable(), heading: z.number().nullable(), recordedAt: z.string() }).nullable(),
    booking: z.object({ id: z.string(), reference: z.string(), status: z.string() }).nullable(),
    vehicle: z.object({ id: z.string(), name: z.string(), plate: z.string(), iconCategory: z.enum(["TUK_TUK", "PASSAPP", "SEDAN", "SUV", "MINIVAN", "MINIBUS", "VAN", "OTHER"]) }).nullable(),
    target: z.object({ address: z.string().nullable(), hub: z.object({ id: z.string(), name: z.string(), address: z.string().nullable(), latitude: z.number(), longitude: z.number() }).nullable() }).nullable(),
    stale: z.boolean(),
  })),
});

const labelKey = {
  AVAILABLE: "fleet.available",
  ASSIGNED: "fleet.assigned",
  TO_PICKUP: "fleet.toPickup",
  ON_TRIP: "fleet.onTrip",
  RETURNING_TO_HUB: "fleet.returning",
} as const satisfies Record<FleetDriver["status"], string>;

export function FleetSupervision() {
  const { t } = useLanguage();
  const [state, setState] = useState<{ drivers: FleetDriver[]; hubs: FleetHub[]; error: boolean; loaded: boolean }>({ drivers: [], hubs: [], error: false, loaded: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [refreshing, setRefreshing] = useState(0);

  const reload = useCallback(() => setRefreshing((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    let busy = false;
    const controller = new AbortController();
    async function poll() {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const response = await fetch("/api/admin/fleet-locations", { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]) });
        if (!response.ok) throw new Error("Fleet data unavailable");
        const parsed = fleetSchema.safeParse(await response.json());
        if (!parsed.success) throw new Error("Fleet response invalid");
        if (active) setState({ ...parsed.data, error: false, loaded: true });
      } catch {
        if (active) setState((previous) => ({ ...previous, error: true, loaded: true }));
      } finally { busy = false; }
    }
    void poll();
    const timer = window.setInterval(poll, 5_000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [refreshing]);

  const selected = state.drivers.find((driver) => driver.id === selectedId) ?? null;
  const content = <div className={expanded ? styles.fleetFullscreenBody : styles.fleetBody}>
    <div className={styles.fleetList} aria-label={t("fleet.drivers")}>
      {state.drivers.map((driver) => <button key={driver.id} type="button" aria-pressed={selectedId === driver.id} onClick={() => setSelectedId(driver.id)} className={styles.fleetDriver}>
        <span className={styles.fleetDot} data-status={driver.status} aria-hidden="true" />
        <span><strong>{driver.name}</strong><small>{t(labelKey[driver.status])}{driver.vehicle ? ` · ${driver.vehicle.name} ${driver.vehicle.plate}` : ""}</small>
          {driver.booking && <small>{driver.booking.reference}</small>}
          {driver.stale && <small>{t("fleet.stale")}</small>}
        </span>
      </button>)}
      {!state.drivers.length && state.loaded && <p className={styles.fleetEmpty}>{t("fleet.noDrivers")}</p>}
    </div>
    <FleetMap drivers={state.drivers} hubs={state.hubs} selectedId={selected?.id ?? null} onSelect={setSelectedId} height={expanded ? "100%" : "480px"} />
  </div>;

  return <section className={expanded ? styles.fleetFullscreen : styles.fleetCard} aria-label={t("fleet.title")}>
    <div className={styles.sectionHeading}><div><h2>{t("fleet.title")}</h2><p className={styles.muted}>{t("fleet.subtitle").replace("{count}", String(state.drivers.filter((driver) => driver.location).length))}</p></div>
      <div className={styles.fleetActions}>
        <button type="button" className={styles.iconButton} onClick={reload} title={t("admin.retry")} aria-label={t("admin.retry")}><RefreshCw size={17} /></button>
        <button type="button" className={styles.iconButton} onClick={() => setExpanded((value) => !value)} title={t(expanded ? "fleet.closeFullscreen" : "fleet.fullscreen")} aria-label={t(expanded ? "fleet.closeFullscreen" : "fleet.fullscreen")}>{expanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      </div>
    </div>
    {state.error && <p role="alert" className={styles.error}>{t("fleet.loadError")}</p>}
    {!state.hubs.length && state.loaded && <p className={styles.fleetNotice}>{t("fleet.hubNotice")}</p>}
    {content}
  </section>;
}
