"use client";

import { useState, type FormEvent } from "react";
import { adminErrorKey, adminRequest, type ManagementData } from "@/lib/admin-client";
import { useLanguage } from "@/components/i18n/language-provider";
import type { operations } from "@/components/i18n/operations";
import { useAuth } from "@/components/auth/auth-provider";
import { enumLabel } from "@/components/i18n/enum-label";
import { useListSort } from "@/components/admin/list-sort";
import { sortDate, type SortField } from "@/lib/list-sort";

type Entity = "user" | "vehicle" | "pricing" | "setting";
type Label = keyof typeof operations.en;
type Field = { key: string; label: Label; type?: "number" | "datetime-local" | "date" | "month" | "url" | "email"; options?: string[]; optional?: boolean };
const categories: Record<Entity, Label> = { user: "records.users", vehicle: "records.vehicles", pricing: "records.pricing", setting: "records.settings" };
const fields: Record<Entity, Field[]> = {
  user: [{ key: "name", label: "records.name" }, { key: "email", label: "records.email", type: "email" }, { key: "phone", label: "records.phone", optional: true }, { key: "status", label: "records.status", options: ["ACTIVE", "SUSPENDED", "INVITED"] }, { key: "isAvailable", label: "records.available", options: ["true", "false"] }, { key: "licenseNo", label: "records.license", optional: true }, { key: "licenseExpiresAt", label: "license.expiry", type: "date", optional: true }],
  vehicle: [{ key: "name", label: "records.name" }, { key: "plate", label: "records.plate" }, { key: "seats", label: "records.seats", type: "number" }, { key: "active", label: "records.active", options: ["true", "false"] }],
  pricing: [{ key: "name", label: "records.name" }, { key: "amountCents", label: "records.fare", type: "number" }, { key: "effectiveAt", label: "records.effective", type: "datetime-local" }, { key: "active", label: "records.active", options: ["true", "false"] }, { key: "direction", label: "records.direction", options: ["", "AIRPORT_TO_CITY", "CITY_TO_AIRPORT"], optional: true }, { key: "tripType", label: "records.tripType", options: ["", "AIRPORT_TRANSFER", "PRIVATE_TRANSFER", "HOTEL_TRANSFER"], optional: true }],
  setting: [{ key: "value", label: "records.image", type: "url" }],
};

export function RecordEditor({ data, disabled, refresh }: { data: ManagementData; disabled: boolean; refresh: () => void }) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [entity, setEntity] = useState<Entity>("user");
  const [selected, setSelected] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReturnType<typeof adminErrorKey> | null>(null);
  const [saved, setSaved] = useState(false);
  const records: Record<Entity, Array<Record<string, unknown>>> = {
    user: data.users.filter((item) => item.id !== user?.id).map((item) => ({ ...item, ...(item.driver ? { isAvailable: item.driver.isAvailable, licenseNo: item.driver.licenseNo, licenseExpiresAt: item.driver.licenseExpiresAt } : {}) })),
    vehicle: data.vehicles,
    pricing: data.pricing, setting: data.settings.filter((setting) => setting.key === "heroBackground"),
  };
  const sortFields: [SortField<Record<string, unknown>>, ...SortField<Record<string, unknown>>[]] = [
    { key: "name", label: t("records.name"), value: (item) => String(item.name ?? item.key ?? "") },
  ];
  if (entity !== "setting") sortFields.push(
    { key: "date", label: t(entity === "pricing" ? "records.effective" : "sorting.created"), value: (item) => sortDate(typeof item.effectiveAt === "string" ? item.effectiveAt : typeof item.createdAt === "string" ? item.createdAt : null) },
    { key: "status", label: t("records.status"), value: (item) => enumLabel(String(item.status ?? item.active), t) },
  );
  if (entity === "pricing") sortFields.push(
    { key: "amount", label: t("finance.amount"), value: (item) => typeof item.amountCents === "number" ? item.amountCents : null },
    { key: "category", label: t("booking.tripType"), value: (item) => typeof item.tripType === "string" ? enumLabel(item.tripType, t) : null },
  );
  if (entity === "vehicle") sortFields.push({ key: "category", label: t("finance.category"), value: (item) => {
    const category = data.vehicles.find((vehicle) => vehicle.id === item.id)?.iconCategory;
    return category ? t(`fleet.category.${category}`) : null;
  } });
  if (entity === "user") sortFields.push({ key: "category", label: t("ui.role"), value: (item) => enumLabel(String(item.role), t) });
  const sorted = useListSort(records[entity], sortFields, { key: "name", direction: "asc" });
  const record = records[entity].find((item) => (item.id ?? item.key) === selected);
  const visibleFields = fields[entity].filter((field) => entity !== "user" || record?.role === "DRIVER" || !["isAvailable", "licenseNo", "licenseExpiresAt"].includes(field.key));
  function defaultValue(field: Field) {
    const value = record?.[field.key];
    if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return field.options?.[0] ?? "";
    if (field.type === "datetime-local") {
      const date = new Date(String(value));
      return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    }
    if (field.type === "month") return String(value).slice(0, 7);
    if (field.type === "date") return String(value).slice(0, 10);
    return String(value);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {};
    for (const field of visibleFields) {
      const value = String(form.get(field.key) ?? "");
      payload[field.key] = field.type === "number" ? Number(value) : field.type === "datetime-local" ? value ? new Date(value).toISOString() : null : ["active", "isAvailable"].includes(field.key) ? value === "true" : ["direction", "tripType"].includes(field.key) ? value || null : value;
    }
    if (entity === "setting") payload.key = "heroBackground";
    setPending(true); setError(null); setSaved(false);
    try {
      await adminRequest("/api/admin/management", { method: record ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, id: selected || undefined, data: payload }) });
      setSaved(true); refresh();
    } catch (error) { setError(adminErrorKey(error)); }
    finally { setPending(false); }
  }
  async function archive() {
    if (pending || !window.confirm(t("courses.confirmArchive"))) return;
    setPending(true); setError(null); setSaved(false);
    try {
      await adminRequest("/api/admin/management", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, id: selected }) });
      setSaved(true); refresh();
    } catch (error) { setError(adminErrorKey(error)); }
    finally { setPending(false); }
  }
  return <section className="mt-8 rounded-[28px] bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">{t("courses.manageRecords")}</h2>
    <p className="mt-2 text-sm text-slate-500">{t("courses.archiveNotice")}</p>
    {sorted.controls}
    <div className="my-4 grid gap-3 md:grid-cols-2">
      <label>{t("courses.entity")}<select disabled={disabled || pending} value={entity} onChange={(event) => { const value = event.target.value; if (value in fields) setEntity(value as Entity); setSelected(""); setSaved(false); setError(null); }} className="mt-1 w-full rounded-xl border p-3">{(Object.keys(categories) as Entity[]).map((key) => <option key={key} value={key}>{t(categories[key])}</option>)}</select></label>
      <label>{t("courses.record")}<select disabled={disabled || pending} value={selected} onChange={(event) => { setSelected(event.target.value); setSaved(false); setError(null); }} className="mt-1 w-full rounded-xl border p-3"><option value="">{entity === "user" ? t("courses.select") : t("courses.newRecord")}</option>{sorted.items.map((item) => <option key={String(item.id ?? item.key)} value={String(item.id ?? item.key)}>{String(item.name ?? item.label ?? item.provider ?? item.month ?? item.key ?? item.id)}</option>)}</select></label>
    </div>
    {entity === "pricing" && <p className="mb-4 text-sm text-slate-600">{t("fare.legacyNotice")} <a href="#fare-policy-heading" className="underline">{t("fare.settings")}</a></p>}
    {!(entity === "user" && !record) && <form key={`${entity}-${selected}`} onSubmit={submit}>
      <fieldset disabled={disabled || pending} className="grid gap-4 md:grid-cols-3">
        {visibleFields.map((field) => <label key={field.key}>{t(field.label)}{field.options ? <select name={field.key} defaultValue={defaultValue(field)} className="mt-1 w-full rounded-xl border p-3">{field.options.map((value) => <option key={value} value={value}>{value ? enumLabel(value, t) : t("records.all")}</option>)}</select> : field.key === "vehicleId" ? <select name={field.key} required defaultValue={defaultValue(field)} className="mt-1 w-full rounded-xl border p-3"><option value="">{t("courses.select")}</option>{data.vehicles.filter((vehicle) => vehicle.active || vehicle.id === record?.vehicleId).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate}</option>)}</select> : <input name={field.key} required={!field.optional} type={field.type ?? "text"} defaultValue={defaultValue(field)} min={field.type === "number" ? 0 : undefined} className="mt-1 w-full rounded-xl border p-3" />}</label>)}
        <button className="rounded-full bg-[var(--color-primary)] p-3 text-white">{t("courses.save")}</button>
      </fieldset>
    </form>}
    {error && <p role="alert" className="mt-3 text-[var(--color-error)]">{t(error)}</p>}
    {record && ["user", "vehicle", "pricing", "contract"].includes(entity) && <button type="button" disabled={disabled || pending} onClick={() => void archive()} className="mt-3 text-[var(--color-error)]">{t("courses.archive")}</button>}
    {saved && <p role="status" className="mt-3 text-emerald-700">{t("admin.recordSaved")}</p>}
  </section>;
}
