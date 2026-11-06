"use client";

import { useState, type FormEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPinned, X } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { adminErrorKey, adminRequest, type ManagementData } from "@/lib/admin-client";
import { DriverLicenses } from "@/components/admin/driver-licenses";
import { DriverBusinessCards } from "@/components/admin/driver-business-cards";
import { gpsRetentionSettingKey } from "@/lib/cron-settings";
import { farePolicyKey } from "@/lib/fare-policy";
import { TariffEditor } from "@/components/admin/tariff-editor";

const VehicleIconPreview = dynamic(() => import("@/components/maps/vehicle-icon-preview").then((module) => module.VehicleIconPreview), { ssr: false, loading: () => <div className="h-[320px] animate-pulse rounded-xl bg-slate-100" /> });
const vehicleIconCategories = ["TUK_TUK", "PASSAPP", "SEDAN", "SUV", "MINIVAN", "MINIBUS", "VAN", "OTHER"] as const;
const vehicleCategoryLabels = {
  TUK_TUK: "fleet.category.TUK_TUK", PASSAPP: "fleet.category.PASSAPP", SEDAN: "fleet.category.SEDAN", SUV: "fleet.category.SUV",
  MINIVAN: "fleet.category.MINIVAN", MINIBUS: "fleet.category.MINIBUS", VAN: "fleet.category.VAN", OTHER: "fleet.category.OTHER",
} as const;

export function ManagementPanel({ data, loading, loadError, onReload }: { data: ManagementData | null; loading: boolean; loadError: ReturnType<typeof adminErrorKey> | null; onReload: () => void }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReturnType<typeof adminErrorKey> | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewVehicleId, setPreviewVehicleId] = useState<string | null>(null);

  async function mutate(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, form?: HTMLFormElement) {
    if (pending) return;
    setPending(true); setError(null); setSaved(false);
    try {
      await adminRequest("/api/admin/management", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      form?.reset(); setSaved(true); onReload();
    } catch (error) { setError(adminErrorKey(error)); }
    finally { setPending(false); }
  }

  function create(event: FormEvent<HTMLFormElement>, entity: string, id?: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form);
    const data: Record<string, unknown> = Object.fromEntries(input.entries());
    if (entity === "accounting") data.amountCents = Math.round(Number(data.amount) * 100);
    if (entity === "forecast") {
      data.expectedRevenueCents = Math.round(Number(data.revenue) * 100);
      data.expectedExpenseCents = Math.round(Number(data.expense) * 100);
    }
    void mutate(id ? "PATCH" : "POST", { entity, ...(id ? { id } : {}), data }, form);
  }

  async function uploadVehicleIcon(vehicleId: string, file?: File) {
    if (!file || pending) return;
    setPending(true); setError(null); setSaved(false);
    try {
      const body = new FormData();
      body.set("file", file);
      await adminRequest(`/api/admin/vehicles/${encodeURIComponent(vehicleId)}/icon`, { method: "PUT", body });
      setSaved(true); onReload();
    } catch (error) { setError(adminErrorKey(error)); }
    finally { setPending(false); }
  }

  if (!data) return <section className="mt-8 rounded-[28px] bg-white p-6 shadow-sm">{t(loadError ? "admin.dataUnavailable" : "admin.loading")}</section>;
  const revenue = data.entries.filter((item) => item.type === "REVENUE" && item.currency === "USD").reduce((sum, item) => sum + item.amountCents, 0) + data.receipts.filter((item) => item.currency === "USD").reduce((sum, item) => sum + item.amountCents, 0);
  const expenses = data.entries.filter((item) => item.type !== "REVENUE").reduce((sum, item) => sum + item.amountCents, 0);
  const forecastRevenue = data.forecasts.reduce((sum, item) => sum + item.expectedRevenueCents, 0);
  const forecastExpenses = data.forecasts.reduce((sum, item) => sum + item.expectedExpenseCents, 0);
  const inputClass = "rounded-xl border p-3";
  const buttonClass = "rounded-full bg-[var(--color-primary)] p-3 text-sm font-semibold text-white";

  return <div className="mt-8 space-y-8">
    <nav aria-label={t("dispatch.management")} className="flex flex-wrap gap-3">
      <a href="#fleet-management" className={buttonClass}>{t("fleet.addVehicle")}</a>
      <a href="#cron-heading" className={buttonClass}>{t("cron.title")}</a>
      <a href="#fare-policy-heading" className={buttonClass}>{t("fare.settings")}</a>
    </nav>
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-[var(--color-error)]">{t(error)}{error === "admin.sessionExpired" && <> <Link href="/auth" className="underline">{t("admin.openSignIn")}</Link></>}</p>}
    {saved && <p role="status" className="text-sm font-semibold text-emerald-700">{t("admin.recordSaved")}</p>}
    <fieldset disabled={pending || loading || Boolean(loadError)} className="contents">
      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 id="fare-policy-heading" className="text-xl font-bold">{t("fare.settings")}</h2>
        <p className="mt-2 text-sm text-slate-500">{t("fare.policyNotice")}</p>
        <TariffEditor key={JSON.stringify(data.farePolicy)} policy={data.farePolicy} history={data.tariffHistory} onSave={(value, effectiveAt) => void mutate("POST", { entity: "setting", data: { key: farePolicyKey, value, ...(effectiveAt ? { effectiveAt } : {}) } })} />
      </section>
      <section className="grid gap-4 md:grid-cols-4">{[["Actual revenue", revenue], ["Actual expenses", expenses], ["Forecast revenue", forecastRevenue], ["Forecast balance", forecastRevenue - forecastExpenses]].map(([label, value]) => <div key={String(label)} className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-3 text-2xl font-black">${(Number(value) / 100).toFixed(2)}</div></div>)}</section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">{t("payment.ledger")}</h2><p className="mt-2 text-sm text-slate-500">{t("payment.ledgerNotice")}</p>
        <div className="mt-4 flex flex-wrap gap-3">{[...new Set(data.receipts.map((item) => item.currency))].map((currency) => <strong key={currency} className="rounded-2xl bg-emerald-50 p-3 text-emerald-800">{new Intl.NumberFormat(language, { style: "currency", currency }).format(data.receipts.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.amountCents, 0) / 100)}</strong>)}</div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>{t("customer.abaReference")}</th><th>{t("payment.receivedVia")}</th><th>{t("admin.driver")}</th><th>{t("booking.date")}</th><th>{t("customer.abaAmount")}</th></tr></thead><tbody>{data.receipts.map((receipt) => <tr key={receipt.id} className="border-t"><td className="py-3">{receipt.booking.reference}<small className="block text-slate-500">{receipt.provider} · {receipt.booking.status}</small></td><td>{receipt.collectionMethod ? t(`payment.${receipt.collectionMethod}`) : receipt.provider === "ABA_PAYWAY" ? t("payment.ABA") : t("payment.legacyMethod")}</td><td>{receipt.booking.driver?.user.name ?? "—"}</td><td>{new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(receipt.updatedAt))}</td><td>{new Intl.NumberFormat(language, { style: "currency", currency: receipt.currency }).format(receipt.amountCents / 100)}</td></tr>)}</tbody></table>{!data.receipts.length && <p className="py-4 text-slate-500">{t("payment.noReceipts")}</p>}</div>
      </section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Accounts and roles</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>{data.users.map((item) => <tr key={item.id} className="border-t"><td className="py-3">{item.name}</td><td>{item.email}</td><td>{item.role}</td><td>{item.status}</td><td>{item.status !== "SUSPENDED" && item.id !== user?.id && <button type="button" onClick={() => { if (window.confirm(t("courses.confirmArchive"))) void mutate("DELETE", { entity: "user", id: item.id }); }} className="text-[var(--color-error)]">Suspend</button>}</td></tr>)}</tbody></table></div></section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm" aria-labelledby="cron-heading">
        <h2 id="cron-heading" className="text-xl font-bold">{t("cron.title")}</h2>
        <p className="mt-2 text-sm text-slate-600">{t("cron.description")}</p>
        <p className="mt-2 text-sm text-slate-500">{t("cron.schedule")}</p>
        {!data.cron.configured && <p role="alert" className="mt-3 text-sm text-[var(--color-error)]">{t("cron.notConfigured")}</p>}
        <label className="mt-4 flex items-center gap-3 font-semibold">
          <input type="checkbox" role="switch" checked={data.cron.gpsRetentionEnabled} disabled={pending || loading || Boolean(loadError)} onChange={(event) => void mutate("POST", { entity: "setting", data: { key: gpsRetentionSettingKey, value: event.target.checked } })} className="h-5 w-5 accent-[var(--color-primary)]" />
          {t("cron.gpsRetention")} · {t(data.cron.gpsRetentionEnabled ? "cron.enabled" : "cron.disabled")}
        </label>
      </section>
      <section className="grid gap-8 lg:grid-cols-2">
        <div id="fleet-management" className="scroll-mt-6 rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">{t("fleet.management")}</h2>
          <p className="mt-2 text-sm text-slate-500">{t("fleet.addVehicleHelp")}</p>
          <form onSubmit={(event) => create(event, "vehicle")} className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="grid gap-2 text-sm">{t("fleet.vehicleName")}<input name="name" required maxLength={500} className={inputClass} /></label>
            <label className="grid gap-2 text-sm">{t("fleet.plate")}<input name="plate" required maxLength={500} className={inputClass} /></label>
            <label className="grid gap-2 text-sm">{t("fleet.seats")}<input name="seats" required type="number" min="1" max="50" defaultValue="4" className={inputClass} /></label>
            <label className="grid gap-2 text-sm sm:col-span-3">{t("fleet.iconCategory")}<select name="iconCategory" defaultValue="OTHER" className={inputClass}>{vehicleIconCategories.map((category) => <option key={category} value={category}>{t(vehicleCategoryLabels[category])}</option>)}</select></label>
            <button type="submit" className={`${buttonClass} sm:col-span-3`}>{t("fleet.addVehicle")}</button>
          </form>
          {!data.vehicles.length && <p className="mt-4 text-sm text-slate-500">{t("fleet.empty")}</p>}
          <div className="mt-5 space-y-3">{data.vehicles.map((item) => <div key={item.id} className="grid gap-2 border-t pt-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
            <span>{item.name} · {item.plate} · {item.seats} {t("fleet.seats")} · {t(item.active ? "fleet.activeVehicle" : "fleet.inactiveVehicle")}</span>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label={`${t("fleet.iconCategory")} · ${item.name}`} className={inputClass} value={item.iconCategory} disabled={pending} onChange={(event) => void mutate("PATCH", { entity: "vehicle", id: item.id, data: { iconCategory: event.target.value } })}>{vehicleIconCategories.map((category) => <option key={category} value={category}>{t(vehicleCategoryLabels[category])}</option>)}</select>
              <button type="button" className={`${buttonClass} inline-flex items-center gap-2`} onClick={() => setPreviewVehicleId(item.id)}><MapPinned size={16} aria-hidden="true" />{t("fleet.previewIcon")}</button>
              <label className={`${buttonClass} cursor-pointer`}>{t(item.iconImage ? "fleet.replaceIcon" : "fleet.uploadIcon")}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} onChange={(event) => { void uploadVehicleIcon(item.id, event.currentTarget.files?.[0]); event.currentTarget.value = ""; }} /></label>
              {item.iconImage && <button type="button" className="text-[var(--color-error)]" disabled={pending} onClick={() => void adminRequest(`/api/admin/vehicles/${encodeURIComponent(item.id)}/icon`, { method: "DELETE" }).then(() => { setSaved(true); onReload(); }).catch((failure) => setError(adminErrorKey(failure)))}>{t("fleet.removeIcon")}</button>}
              {item.active && <button type="button" onClick={() => { if (window.confirm(t("courses.confirmArchive"))) void mutate("DELETE", { entity: "vehicle", id: item.id }); }} className="text-[var(--color-error)]">{t("fleet.disableVehicle")}</button>}
            </div>
          </div>)}</div>
        </div>
        <div className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Accounting entries</h2><form onSubmit={(event) => create(event, "accounting")} className="mt-4 grid gap-3 sm:grid-cols-3"><select name="type" className={inputClass}>{["REVENUE", "EXPENSE", "CREDIT", "PURCHASE"].map((value) => <option key={value}>{value}</option>)}</select><input name="label" required placeholder="Description" className={inputClass} /><input name="amount" required type="number" min="0" step="0.01" placeholder="USD" className={inputClass} /><button className={`${buttonClass} sm:col-span-3`}>Add entry</button></form><div className="mt-5 space-y-2">{data.entries.map((item) => <div key={item.id} className="flex justify-between border-t pt-3 text-sm"><span>{item.type} · {item.label}</span><span>${(item.amountCents / 100).toFixed(2)}</span></div>)}</div></div>
      </section>
      <DriverLicenses users={data.users} />
      <DriverBusinessCards users={data.users} onChanged={onReload} />
      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">{t("fleet.hubs")}</h2>
        <p className="mt-2 text-sm text-slate-500">{t("fleet.hubsHelp")}</p>
        <form onSubmit={(event) => create(event, "hub")} className="mt-4 grid gap-3 md:grid-cols-5">
          <input name="name" required maxLength={500} placeholder={t("fleet.hubName")} className={inputClass} />
          <input name="address" maxLength={500} placeholder={t("fleet.hubAddress")} className={inputClass} />
          <input name="latitude" required type="number" min="-90" max="90" step="any" placeholder={t("fleet.latitude")} className={inputClass} />
          <input name="longitude" required type="number" min="-180" max="180" step="any" placeholder={t("fleet.longitude")} className={inputClass} />
          <button className={buttonClass}>{t("fleet.addHub")}</button>
        </form>
        <div className="mt-5 space-y-3">{data.hubs.map((hub) => <form key={hub.id} onSubmit={(event) => create(event, "hub", hub.id)} className="grid gap-2 border-t pt-3 sm:grid-cols-5">
          <input name="name" required maxLength={500} defaultValue={hub.name} className={inputClass} />
          <input name="address" maxLength={500} defaultValue={hub.address ?? ""} placeholder={t("fleet.hubAddress")} className={inputClass} />
          <input name="latitude" required type="number" min="-90" max="90" step="any" defaultValue={hub.latitude} className={inputClass} />
          <input name="longitude" required type="number" min="-180" max="180" step="any" defaultValue={hub.longitude} className={inputClass} />
          <div className="flex gap-2"><button type="submit" className={buttonClass}>{t("dispatch.save")}</button>{hub.active && <button type="button" className="text-[var(--color-error)]" onClick={() => void mutate("DELETE", { entity: "hub", id: hub.id })}>{t("fleet.disableHub")}</button>}</div>
        </form>)}</div>
      </section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Forecast accounts</h2><form onSubmit={(event) => create(event, "forecast")} className="mt-4 grid gap-3 md:grid-cols-4"><input name="month" required type="month" className={inputClass} /><input name="revenue" required type="number" min="0" step="0.01" placeholder="Expected revenue" className={inputClass} /><input name="expense" required type="number" min="0" step="0.01" placeholder="Expected expenses" className={inputClass} /><button className={buttonClass}>Add forecast</button></form><div className="mt-5 grid gap-3 md:grid-cols-3">{data.forecasts.map((item) => <div key={item.id} className="rounded-2xl bg-[var(--color-input)] p-4 text-sm"><div>{item.month.slice(0, 7)}</div><div>+${(item.expectedRevenueCents / 100).toFixed(2)}</div><div>-${(item.expectedExpenseCents / 100).toFixed(2)}</div></div>)}</div></section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Vehicle rentals and financing</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{data.contracts.map((item) => <div key={item.id} className="rounded-2xl border p-4">{item.vehicle.name} · {item.vehicle.plate}<p>{item.provider} · ${(item.monthlyCents / 100).toFixed(2)} / month · {item.status}</p></div>)}</div></section>
    </fieldset>
    {previewVehicleId && (() => {
      const vehicle = data.vehicles.find((item) => item.id === previewVehicleId);
      return vehicle ? <div className="fixed inset-0 z-[1200] grid place-items-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label={t("fleet.previewMap")}>
        <section className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
          <header className="mb-4 flex items-center justify-between gap-4"><div><h2 className="text-xl font-bold">{t("fleet.previewIcon")}</h2><p className="text-sm text-slate-600">{vehicle.name} · {vehicle.plate} · {t(vehicleCategoryLabels[vehicle.iconCategory])}</p></div>
            <button type="button" className={buttonClass} onClick={() => setPreviewVehicleId(null)} aria-label={t("fleet.closeFullscreen")}><X size={18} aria-hidden="true" /></button>
          </header>
          <VehicleIconPreview vehicleId={vehicle.id} category={vehicle.iconCategory} />
        </section>
      </div> : null;
    })()}
  </div>;
}
