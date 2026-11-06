"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { type FarePolicy } from "@/lib/fare-policy";
import type { ManagementData } from "@/lib/admin-client";

const categories = ["TUK_TUK", "PASSAPP", "SEDAN", "SUV", "MINIVAN", "MINIBUS", "VAN", "OTHER"] as const;
export function TariffEditor({ policy, history, onSave }: {
  policy: FarePolicy; history: ManagementData["tariffHistory"]; onSave: (value: FarePolicy, effectiveAt?: string) => void;
}) {
  const { t, language } = useLanguage();
  const [zones, setZones] = useState(policy.zones);
  const [times, setTimes] = useState(policy.timeSurcharges);
  const [extras, setExtras] = useState(policy.exceptionalSurcharges);
  const input = "mt-1 w-full rounded-xl border p-3";
  const button = "rounded-xl border p-3 text-sm font-semibold";
  return <div><form className="mt-4 space-y-5" onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = (key: string) => Math.round(Number(form.get(key)) * 100);
    const effective = String(form.get("effective") ?? "");
    onSave({
      ...policy, airportCents: amount("airport"), cityCentsPerKm: amount("city"),
      smallCircuitCents: amount("small"), grandCircuitCents: amount("grand"),
      remoteCircuitCents: String(form.get("remote")).trim() === "" ? null : amount("remote"),
      tourIncludedHours: Number(form.get("hours")), tourIncludedKm: Number(form.get("km")), tourExtraHourCents: amount("extra"),
      cityPickupCents: amount("pickup"), cityMinimumCents: amount("minimum"),
      vehicleSurcharges: Object.fromEntries(categories.map((category) => [category, amount(category)])),
      zones, timeSurcharges: times, exceptionalSurcharges: extras,
      khrPerUsd: String(form.get("khr")).trim() === "" ? null : Number(form.get("khr")),
    }, effective ? new Date(`${effective}:00+07:00`).toISOString() : undefined);
  }}>
    <div className="grid gap-4 sm:grid-cols-2">
      {([
        ["airport", "fare.airport", policy.airportCents / 100, 30], ["city", "fare.cityRate", policy.cityCentsPerKm / 100, 100000],
        ["small", "fare.small", policy.smallCircuitCents / 100, 100000], ["grand", "fare.grand", policy.grandCircuitCents / 100, 100000],
        ["remote", "fare.remote", policy.remoteCircuitCents === null ? "" : policy.remoteCircuitCents / 100, 100000],
        ["extra", "fare.extraHourRate", policy.tourExtraHourCents / 100, 100000], ["pickup", "auto.pickup", policy.cityPickupCents / 100, 100000],
        ["minimum", "auto.minimum", policy.cityMinimumCents / 100, 100000],
      ] as const).map(([name, label, value, max]) => <label key={name} className="text-sm">{t(label)}<input name={name} type="number" required={name !== "remote"} min={["city", "small", "grand", "remote"].includes(name) ? 0.01 : 0} max={max} step="0.01" defaultValue={value} className={input} /></label>)}
      <label className="text-sm">{t("fare.includedHours")}<input name="hours" type="number" required min="1" max="24" defaultValue={policy.tourIncludedHours} className={input} /></label>
      <label className="text-sm">{t("fare.includedKm")}<input name="km" type="number" required min="0.01" max="1000" step="0.01" defaultValue={policy.tourIncludedKm} className={input} /></label>
      <label className="text-sm">{t("auto.khr")}<input name="khr" type="number" min="0.01" max="1000000" step="0.01" defaultValue={policy.khrPerUsd ?? ""} className={input} /></label>
      <label className="text-sm">{t("auto.effective")}<input name="effective" type="datetime-local" className={input} /></label>
    </div>
    <h3 className="font-bold">{t("auto.zones")}</h3>
    {zones.map((zone, index) => <fieldset key={zone.id} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
      <label className="text-sm">{t("auto.zoneName")}<input required maxLength={100} value={zone.name} onChange={(event) => setZones(zones.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} className={input} /></label>
      {(["latitude", "longitude", "radiusKm"] as const).map((field) => <label key={field} className="text-sm">{t(field === "radiusKm" ? "auto.radius" : `fleet.${field}`)}<input type="number" required step="any" min={field === "latitude" ? -90 : field === "longitude" ? -180 : 0.001} max={field === "latitude" ? 90 : field === "longitude" ? 180 : 500} value={zone[field]} onChange={(event) => setZones(zones.map((item, i) => i === index ? { ...item, [field]: Number(event.target.value) } : item))} className={input} /></label>)}
      <label><input type="checkbox" checked={zone.active} onChange={(event) => setZones(zones.map((item, i) => i === index ? { ...item, active: event.target.checked } : item))} /> {t("records.active")}</label>
      <button type="button" className={button} onClick={() => setZones(zones.filter((_, i) => i !== index))}>{t("auto.remove")}</button>
    </fieldset>)}
    <button type="button" className={button} disabled={zones.length >= 30} onClick={() => setZones([...zones, { id: crypto.randomUUID(), name: "", latitude: 13.36, longitude: 103.85, radiusKm: 20, active: true }])}>{t("auto.addZone")}</button>
    <h3 className="font-bold">{t("auto.vehicleFees")}</h3>
    <div className="grid gap-3 sm:grid-cols-4">{categories.map((category) => <label key={category} className="text-sm">{t(`fleet.category.${category}`)}<input name={category} type="number" required min="0" max="100000" step="0.01" defaultValue={(policy.vehicleSurcharges[category] ?? 0) / 100} className={input} /></label>)}</div>
    <h3 className="font-bold">{t("auto.timeFees")}</h3>
    {times.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-4">
      <label>{t("auto.label")}<input required maxLength={100} value={item.label} onChange={(event) => setTimes(times.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} className={input} /></label>
      {(["startHour", "endHour", "cents"] as const).map((field) => <label key={field}>{t(field === "cents" ? "auto.amount" : `auto.${field}`)}<input required type="number" min="0" max={field === "cents" ? 100000 : 23} step={field === "cents" ? "0.01" : "1"} value={field === "cents" ? item.cents / 100 : item[field]} onChange={(event) => setTimes(times.map((entry, i) => i === index ? { ...entry, [field]: Math.round(Number(event.target.value) * (field === "cents" ? 100 : 1)) } : entry))} className={input} /></label>)}
      <button type="button" className={button} onClick={() => setTimes(times.filter((_, i) => i !== index))}>{t("auto.remove")}</button>
    </div>)}
    <button type="button" className={button} disabled={times.length >= 24} onClick={() => setTimes([...times, { label: "", startHour: 22, endHour: 6, cents: 0 }])}>{t("auto.addTime")}</button>
    <h3 className="font-bold">{t("auto.extraFees")}</h3>
    {extras.map((item, index) => <div key={index} className="grid gap-3 rounded-xl border p-3 sm:grid-cols-3">
      <label>{t("auto.label")}<input required maxLength={100} value={item.label} onChange={(event) => setExtras(extras.map((entry, i) => i === index ? { ...entry, label: event.target.value } : entry))} className={input} /></label>
      <label>{t("auto.amount")}<input required type="number" min="0" max="100000" step="0.01" value={item.cents / 100} onChange={(event) => setExtras(extras.map((entry, i) => i === index ? { ...entry, cents: Math.round(Number(event.target.value) * 100) } : entry))} className={input} /></label>
      <button type="button" className={button} onClick={() => setExtras(extras.filter((_, i) => i !== index))}>{t("auto.remove")}</button>
    </div>)}
    <button type="button" className={button} disabled={extras.length >= 20} onClick={() => setExtras([...extras, { label: "", cents: 0 }])}>{t("auto.addExtra")}</button>
    <button type="submit" className="block w-full rounded-xl bg-[var(--color-primary)] p-4 font-bold text-white">{t("fare.save")}</button>
  </form>
  <details className="mt-5"><summary className="cursor-pointer font-bold">{t("auto.tariffHistory")}</summary>{history?.map((version) => <details key={version.id} className="mt-3 rounded-xl border p-3"><summary>{new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(version.effectiveAt))} · {(version.policy.cityCentsPerKm / 100).toFixed(2)} USD/km · {version.policy.zones.map((zone) => zone.name).join(", ")}</summary><pre className="overflow-auto text-xs">{JSON.stringify(version.policy, null, 2)}</pre></details>)}</details>
  </div>;
}
