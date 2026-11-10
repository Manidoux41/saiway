"use client";

import { useState } from "react";
import { adminErrorKey, adminRequest, type ManagementData } from "@/lib/admin-client";
import { useLanguage } from "@/components/i18n/language-provider";
import { enumLabel } from "@/components/i18n/enum-label";

type Entry = Pick<ManagementData["entries"][number], "id" | "updatedAt" | "type" | "category" | "label" | "amountCents" | "currency" | "entryDate" | "paidAt" | "vehicleId" | "notes" | "sourceKey">;
type Props = { data: ManagementData; disabled: boolean; onSaved: () => void; onCancel?: () => void } & (
  { entity: "accounting"; record?: Entry } |
  { entity: "forecast"; record?: ManagementData["forecasts"][number] } |
  { entity: "contract"; record?: ManagementData["contracts"][number] }
);

function localDateTime(value?: string | null) {
  return value ? new Date(Date.parse(value) + 7 * 3_600_000).toISOString().slice(0, 16) : "";
}

export function FinanceRecordForm(props: Props) {
  const { t } = useLanguage();
  const { record, entity } = props;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReturnType<typeof adminErrorKey> | null>(null);
  const [saved, setSaved] = useState(false);
  const input = "mt-1 w-full min-w-0 rounded-xl border p-3";
  async function submit(form: HTMLFormElement, removing = false) {
    if (pending) return;
    const fields = new FormData(form);
    if (removing && !window.confirm(t("finance.confirmDelete"))) return;
    const text = (key: string) => String(fields.get(key) ?? "");
    const amount = (key: string) => Math.round(Number(text(key)) * 100);
    const date = (key: string) => text(key) ? new Date(`${text(key)}+07:00`).toISOString() : null;
    const values: Record<string, unknown> = {};
    if (record) {
      values.expectedUpdatedAt = record.updatedAt;
      values.reason = text("reason");
    }
    if (!removing) {
      if (entity === "accounting") Object.assign(values, {
        type: props.record?.sourceKey ? props.record.type : text("type"),
        category: props.record?.sourceKey ? props.record.category : text("category"),
        label: text("label"), amountCents: amount("amount"), entryDate: date("entryDate"),
        paidAt: date("paidAt"), vehicleId: text("vehicleId") || null, notes: text("notes"),
      });
      if (entity === "forecast") Object.assign(values, {
        month: text("month"), expectedRevenueCents: amount("revenue"),
        expectedExpenseCents: amount("expense"), notes: text("notes"),
      });
      if (entity === "contract") Object.assign(values, {
        vehicleId: text("vehicleId"), provider: text("provider"), monthlyCents: amount("monthly"),
        startsAt: date("startsAt"), endsAt: date("endsAt"), status: text("status"), kind: text("kind"),
      });
    }
    setPending(true); setError(null); setSaved(false);
    try {
      await adminRequest("/api/admin/management", {
        method: removing ? "DELETE" : record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, id: record?.id, data: values }),
      });
      if (!record) form.reset();
      setSaved(true); props.onSaved();
    } catch (failure) { setError(adminErrorKey(failure)); }
    finally { setPending(false); }
  }
  const vehicleField = (value: string | null | undefined, required: boolean) => <label>{t("records.vehicles")}<select name="vehicleId" required={required} defaultValue={value ?? ""} className={input}><option value="">{t("finance.noVehicle")}</option>{props.data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate}</option>)}</select></label>;
  return <form onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }} className="min-w-0 space-y-3">
    <p className="text-sm text-slate-600">{t("finance.editHelp")}</p>
    <fieldset disabled={props.disabled || pending} className="grid min-w-0 gap-3 sm:grid-cols-2">
      {props.entity === "accounting" && <>
        <label>{t("records.type")}<select name="type" disabled={Boolean(props.record?.sourceKey)} defaultValue={props.record?.type ?? "REVENUE"} className={input}>{["REVENUE", "EXPENSE", "CREDIT", "PURCHASE"].map((value) => <option key={value} value={value}>{enumLabel(value, t)}</option>)}</select></label>
        <label>{t("finance.category")}<select name="category" disabled={Boolean(props.record?.sourceKey)} defaultValue={props.record?.category ?? "TRIP"} className={input}>{(["TRIP", "FUEL", "MAINTENANCE", "SALARY", "OTHER"] as const).map((value) => <option key={value} value={value}>{t(`finance.${value}`)}</option>)}</select></label>
        <label>{t("records.description")}<input name="label" required maxLength={500} defaultValue={props.record?.label ?? ""} className={input} /></label>
        <label>{t("finance.amount")} ({props.record?.currency ?? "USD"})<input name="amount" required type="number" min="0" max="1000000" step="0.01" defaultValue={props.record ? props.record.amountCents / 100 : ""} className={input} /></label>
        <label>{t("finance.date")} ({t("finance.cambodiaTime")})<input name="entryDate" required type="datetime-local" defaultValue={localDateTime(props.record?.entryDate)} className={input} /></label>
        <label>{t("finance.paidAt")} ({t("finance.cambodiaTime")})<input name="paidAt" type="datetime-local" defaultValue={localDateTime(props.record?.paidAt)} className={input} /></label>
        {vehicleField(props.record?.vehicleId, false)}
        <label>{t("finance.notes")}<textarea name="notes" maxLength={2000} defaultValue={props.record?.notes ?? ""} className={input} /></label>
      </>}
      {props.entity === "forecast" && <>
        <label>{t("records.month")}<input name="month" type="month" required defaultValue={props.record?.month.slice(0, 7) ?? ""} className={input} /></label>
        <label>{t("ui.expectedRevenue")} (USD)<input name="revenue" type="number" required min="0" max="1000000" step="0.01" defaultValue={props.record ? props.record.expectedRevenueCents / 100 : ""} className={input} /></label>
        <label>{t("ui.expectedExpenses")} (USD)<input name="expense" type="number" required min="0" max="1000000" step="0.01" defaultValue={props.record ? props.record.expectedExpenseCents / 100 : ""} className={input} /></label>
        <label>{t("finance.notes")}<textarea name="notes" maxLength={2000} defaultValue={props.record?.notes ?? ""} className={input} /></label>
      </>}
      {props.entity === "contract" && <>
        {vehicleField(props.record?.vehicleId, true)}
        <label>{t("records.type")}<select name="kind" defaultValue={props.record?.kind ?? "RENTAL"} className={input}>{(["RENTAL", "FINANCING"] as const).map((kind) => <option key={kind} value={kind}>{t(`finance.${kind}`)}</option>)}</select></label>
        <label>{t("records.provider")}<input name="provider" required maxLength={500} defaultValue={props.record?.provider ?? ""} className={input} /></label>
        <label>{t("finance.monthlyAmount")} (USD)<input name="monthly" required type="number" min="0" max="1000000" step="0.01" defaultValue={props.record ? props.record.monthlyCents / 100 : ""} className={input} /></label>
        <label>{t("records.start")} ({t("finance.cambodiaTime")})<input name="startsAt" required type="datetime-local" defaultValue={localDateTime(props.record?.startsAt)} className={input} /></label>
        <label>{t("records.end")} ({t("finance.cambodiaTime")})<input name="endsAt" type="datetime-local" defaultValue={localDateTime(props.record?.endsAt)} className={input} /></label>
        <label>{t("records.status")}<select name="status" defaultValue={props.record?.status ?? "ACTIVE"} className={input}>{["ACTIVE", "INACTIVE"].map((status) => <option key={status} value={status}>{enumLabel(status, t)}</option>)}</select></label>
      </>}
      {record && <label className="sm:col-span-2">{t("finance.reason")}<textarea name="reason" required maxLength={2000} className={input} /></label>}
      <div className="flex flex-wrap gap-3 sm:col-span-2">
        <button type="submit" className="rounded-full bg-[var(--color-primary)] px-5 py-3 text-white">{t("courses.save")}</button>
        {record && <button type="submit" formNoValidate className="rounded-full border border-red-300 px-5 py-3 text-red-700" onClick={(event) => {
          event.preventDefault();
          const form = event.currentTarget.form;
          if (!form) return;
          const reason = form.elements.namedItem("reason");
          if (reason instanceof HTMLTextAreaElement && !reason.reportValidity()) return;
          void submit(form, true);
        }}>{t("finance.delete")}</button>}
        {props.onCancel && <button type="button" onClick={props.onCancel} className="rounded-full border px-5 py-3">{t("finance.close")}</button>}
      </div>
    </fieldset>
    {error && <p role="alert" className="text-red-700">{t(error)}</p>}
    {saved && <p role="status" className="text-emerald-700">{t("admin.recordSaved")}</p>}
  </form>;
}
