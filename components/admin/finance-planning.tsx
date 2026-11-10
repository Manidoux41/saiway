"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { localizedDate, localizedNumber } from "@/lib/locale-format";
import type { ManagementData } from "@/lib/admin-client";
import { FinanceRecordForm } from "@/components/admin/finance-record-form";
import { contractPeriod } from "@/lib/accounting-policy";
import { useListSort } from "@/components/admin/list-sort";
import { sortDate } from "@/lib/list-sort";

export function FinancePlanning({ entity, data, disabled, onChanged }: { entity: "forecast" | "contract"; data: ManagementData; disabled: boolean; onChanged: () => void }) {
  const { t, language } = useLanguage();
  const [selected, setSelected] = useState("");
  const [period, setPeriod] = useState("");
  const [revision, setRevision] = useState(0);
  const forecasts = useListSort(data.forecasts, [
    { key: "date", label: t("records.month"), value: (item) => sortDate(item.month) },
    { key: "revenue", label: t("ui.expectedRevenue"), value: (item) => item.expectedRevenueCents },
    { key: "expense", label: t("ui.expectedExpenses"), value: (item) => item.expectedExpenseCents },
    { key: "updated", label: t("sorting.updated"), value: (item) => sortDate(item.updatedAt) },
  ], { key: "date", direction: "asc" });
  const contracts = useListSort(data.contracts, [
    { key: "date", label: t("records.start"), value: (item) => sortDate(item.startsAt) },
    { key: "end", label: t("records.end"), value: (item) => sortDate(item.endsAt) },
    { key: "category", label: t("records.type"), value: (item) => t(`finance.${item.kind}`) },
    { key: "period", label: t("finance.period"), value: (item) => t(`finance.${contractPeriod(item)}`) },
    { key: "vehicle", label: t("records.vehicles"), value: (item) => `${item.vehicle.name} ${item.vehicle.plate}` },
    { key: "provider", label: t("records.provider"), value: (item) => item.provider },
    { key: "amount", label: t("finance.amount"), value: (item) => item.monthlyCents },
  ], { key: "date", direction: "desc" });
  const money = (cents: number) => localizedNumber(language, { style: "currency", currency: "USD" }).format(cents / 100);
  const date = (value: string) => localizedDate(language, { dateStyle: "medium", timeZone: "Asia/Phnom_Penh" }).format(new Date(value));
  const button = "min-h-11 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-[var(--color-primary)]";
  const changed = () => { setSelected(""); setRevision((value) => value + 1); onChanged(); };
  return <section className="min-w-0 space-y-5 rounded-2xl bg-white p-5">
    <h2 className="text-xl font-bold">{t(entity === "forecast" ? "ui.forecasts" : "finance.contracts")}</h2>
    <button type="button" className={button} disabled={disabled} onClick={() => { setSelected(""); setRevision((value) => value + 1); }}>{t("courses.newRecord")}</button>
    {entity === "contract" ? <FinanceRecordForm key={`${selected}-${revision}`} entity="contract" record={data.contracts.find((item) => item.id === selected)} data={data} disabled={disabled} onSaved={changed} /> : <FinanceRecordForm key={`${selected}-${revision}`} entity="forecast" record={data.forecasts.find((item) => item.id === selected)} data={data} disabled={disabled} onSaved={changed} />}
    {entity === "contract" && <label className="block">{t("finance.period")}<select className="mt-1 w-full rounded-xl border p-3" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="">{t("records.all")}</option>{(["CURRENT", "UPCOMING", "PAST"] as const).map((value) => <option key={value} value={value}>{t(`finance.${value}`)}</option>)}</select></label>}
    {entity === "forecast" ? forecasts.controls : contracts.controls}
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {entity === "forecast" ? forecasts.items.map((item) => <article key={item.id} className="min-w-0 rounded-2xl border p-4">
        <h3 className="font-bold">{localizedDate(language, { month: "long", year: "numeric", timeZone: "Asia/Phnom_Penh" }).format(new Date(item.month))}</h3>
        <p>{t("ui.expectedRevenue")}: {money(item.expectedRevenueCents)}</p><p>{t("ui.expectedExpenses")}: {money(item.expectedExpenseCents)}</p>
        {item.notes && <p className="break-words">{item.notes}</p>}
        <button type="button" className={`${button} mt-3`} disabled={disabled} onClick={() => setSelected(item.id)}>{t("finance.editDelete")}</button>
      </article>) : contracts.items.filter((item) => !period || contractPeriod(item) === period).map((item) => <article key={item.id} className="min-w-0 rounded-2xl border p-4">
        <h3 className="break-words font-bold">{item.vehicle.name} · {item.vehicle.plate}</h3>
        <p>{t(`finance.${item.kind}`)} · {t(`finance.${contractPeriod(item)}`)}</p><p className="break-words">{item.provider} · {money(item.monthlyCents)} {t("ui.perMonth")}</p>
        <p>{date(item.startsAt)} — {item.endsAt ? date(item.endsAt) : t("finance.openEnd")}</p>
        <button type="button" className={`${button} mt-3`} disabled={disabled} onClick={() => setSelected(item.id)}>{t("finance.editDelete")}</button>
      </article>)}
    </div>
  </section>;
}
