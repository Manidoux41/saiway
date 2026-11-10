"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { localizedDate, localizedNumber } from "@/lib/locale-format";
import type { ManagementData } from "@/lib/admin-client";
import { FinanceRecordForm } from "@/components/admin/finance-record-form";
import { contractPeriod } from "@/lib/accounting-policy";

export function FinancePlanning({ entity, data, disabled, onChanged }: { entity: "forecast" | "contract"; data: ManagementData; disabled: boolean; onChanged: () => void }) {
  const { t, language } = useLanguage();
  const [selected, setSelected] = useState("");
  const [period, setPeriod] = useState("");
  const [revision, setRevision] = useState(0);
  const money = (cents: number) => localizedNumber(language, { style: "currency", currency: "USD" }).format(cents / 100);
  const date = (value: string) => localizedDate(language, { dateStyle: "medium", timeZone: "Asia/Phnom_Penh" }).format(new Date(value));
  const button = "min-h-11 rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-[var(--color-primary)]";
  const changed = () => { setSelected(""); setRevision((value) => value + 1); onChanged(); };
  return <section className="min-w-0 space-y-5 rounded-2xl bg-white p-5">
    <h2 className="text-xl font-bold">{t(entity === "forecast" ? "ui.forecasts" : "finance.contracts")}</h2>
    <button type="button" className={button} disabled={disabled} onClick={() => { setSelected(""); setRevision((value) => value + 1); }}>{t("courses.newRecord")}</button>
    {entity === "contract" ? <FinanceRecordForm key={`${selected}-${revision}`} entity="contract" record={data.contracts.find((item) => item.id === selected)} data={data} disabled={disabled} onSaved={changed} /> : <FinanceRecordForm key={`${selected}-${revision}`} entity="forecast" record={data.forecasts.find((item) => item.id === selected)} data={data} disabled={disabled} onSaved={changed} />}
    {entity === "contract" && <label className="block">{t("finance.period")}<select className="mt-1 w-full rounded-xl border p-3" value={period} onChange={(event) => setPeriod(event.target.value)}><option value="">{t("records.all")}</option>{(["CURRENT", "UPCOMING", "PAST"] as const).map((value) => <option key={value} value={value}>{t(`finance.${value}`)}</option>)}</select></label>}
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {entity === "forecast" ? data.forecasts.map((item) => <article key={item.id} className="min-w-0 rounded-2xl border p-4">
        <h3 className="font-bold">{localizedDate(language, { month: "long", year: "numeric", timeZone: "Asia/Phnom_Penh" }).format(new Date(item.month))}</h3>
        <p>{t("ui.expectedRevenue")}: {money(item.expectedRevenueCents)}</p><p>{t("ui.expectedExpenses")}: {money(item.expectedExpenseCents)}</p>
        {item.notes && <p className="break-words">{item.notes}</p>}
        <button type="button" className={`${button} mt-3`} disabled={disabled} onClick={() => setSelected(item.id)}>{t("finance.editDelete")}</button>
      </article>) : data.contracts.filter((item) => !period || contractPeriod(item) === period).map((item) => <article key={item.id} className="min-w-0 rounded-2xl border p-4">
        <h3 className="break-words font-bold">{item.vehicle.name} · {item.vehicle.plate}</h3>
        <p>{t(`finance.${item.kind}`)} · {t(`finance.${contractPeriod(item)}`)}</p><p className="break-words">{item.provider} · {money(item.monthlyCents)} {t("ui.perMonth")}</p>
        <p>{date(item.startsAt)} — {item.endsAt ? date(item.endsAt) : t("finance.openEnd")}</p>
        <button type="button" className={`${button} mt-3`} disabled={disabled} onClick={() => setSelected(item.id)}>{t("finance.editDelete")}</button>
      </article>)}
    </div>
  </section>;
}
