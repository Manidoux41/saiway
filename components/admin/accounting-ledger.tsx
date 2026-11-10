"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { localizedDate, localizedNumber } from "@/lib/locale-format";
import { accountingBalance, accountingMonth, ledgerRows } from "@/lib/accounting-policy";
import type { ManagementData } from "@/lib/admin-client";
import { enumLabel } from "@/components/i18n/enum-label";
import { FinanceRecordForm } from "@/components/admin/finance-record-form";
import { useListSort } from "@/components/admin/list-sort";
import { sortDate } from "@/lib/list-sort";

const categories = ["TRIP", "FUEL", "MAINTENANCE", "SALARY", "OTHER"] as const;
const categoryKeys = { TRIP: "finance.TRIP", FUEL: "finance.FUEL", MAINTENANCE: "finance.MAINTENANCE", SALARY: "finance.SALARY", OTHER: "finance.OTHER" } as const;

export function AccountingLedger({ data, disabled, onChanged }: { data: ManagementData; disabled: boolean; onChanged: () => void }) {
  const { t, language } = useLanguage();
  const [month, setMonth] = useState(() => accountingMonth(new Date().toISOString()));
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState("");
  const rows = ledgerRows(data);
  const monthly = rows.filter((row) => !month || accountingMonth(row.date) === month);
  const sorted = useListSort(monthly, [
    { key: "date", label: t("finance.date"), value: (item) => sortDate(item.date) },
    { key: "category", label: t("finance.category"), value: (item) => enumLabel(item.category, t) },
    { key: "type", label: t("records.type"), value: (item) => enumLabel(item.type, t) },
    { key: "label", label: t("records.description"), value: (item) => item.label },
    { key: "amount", label: t("finance.amount"), value: (item) => item.amountCents },
    { key: "currency", label: "USD / KHR", value: (item) => item.currency },
    { key: "vehicle", label: t("records.vehicles"), value: (item) => data.vehicles.find((vehicle) => vehicle.id === item.vehicleId)?.plate },
    { key: "status", label: t("records.status"), value: (item) => t(item.paid ? "finance.paid" : "finance.unpaid") },
  ], { key: "date", direction: "desc" });
  const visible = sorted.items.filter((row) => (!category || row.category === category) && (!type || row.type === type) && (!vehicle || row.vehicleId === vehicle) && (!query || row.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) && (!from || accountingMonthDay(row.date) >= from) && (!to || accountingMonthDay(row.date) <= to));
  const currencies = [...new Set(monthly.map((row) => row.currency))];
  const money = (cents: number, currency: string) => localizedNumber(language, { style: "currency", currency }).format(cents / 100);
  const input = "mt-1 w-full min-w-0 rounded-xl border p-3";
  const entry = data.entries.find((item) => item.id === selected && !item.deletedAt);
  const receipt = selected.startsWith("payment:") ? data.receipts.find((item) => `payment:${item.id}` === selected) : null;
  const editing = entry ?? (receipt ? {
    id: selected, updatedAt: receipt.updatedAt, sourceKey: selected, type: "REVENUE", category: "TRIP" as const,
    label: receipt.booking.reference, amountCents: receipt.amountCents, currency: receipt.currency,
    entryDate: receipt.confirmedAt ?? receipt.updatedAt, paidAt: receipt.confirmedAt ?? receipt.updatedAt,
    vehicleId: receipt.booking.vehicleId, notes: null,
  } : undefined);
  return <section id="accounting-ledger" className="min-w-0 space-y-5 rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-xl font-bold">{t("finance.title")}</h2>
    <p className="text-sm leading-6 text-slate-600">{t("finance.notice")}</p>
    {editing && <section className="rounded-2xl border border-blue-200 p-4"><h3 className="mb-4 font-bold">{t("finance.editDelete")}</h3><FinanceRecordForm key={editing.id} entity="accounting" record={editing} data={data} disabled={disabled} onCancel={() => setSelected("")} onSaved={() => { setSelected(""); onChanged(); }} /></section>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label>{t("records.month")}<input type="month" value={month} onChange={(event) => setMonth(event.target.value)} className={input} /></label>
      <label>{t("finance.category")}<select value={category} onChange={(event) => setCategory(event.target.value)} className={input}><option value="">{t("records.all")}</option>{categories.map((value) => <option key={value} value={value}>{t(categoryKeys[value])}</option>)}</select></label>
      <label>{t("records.type")}<select value={type} onChange={(event) => setType(event.target.value)} className={input}><option value="">{t("records.all")}</option>{["REVENUE", "EXPENSE", "PURCHASE", "CREDIT"].map((value) => <option key={value} value={value}>{enumLabel(value, t)}</option>)}</select></label>
      <label>{t("records.vehicles")}<select value={vehicle} onChange={(event) => setVehicle(event.target.value)} className={input}><option value="">{t("records.all")}</option>{data.vehicles.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.plate}</option>)}</select></label>
      <label>{t("finance.from")}<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className={input} /></label>
      <label>{t("finance.to")}<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className={input} /></label>
      <label>{t("finance.search")}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={input} /></label>
    </div>
    {sorted.controls}
    <p className="text-xs text-slate-500">{t("finance.summaryScope")}</p>
    {(currencies.length ? currencies : ["USD"]).map((currency) => {
      const balance = accountingBalance(monthly, currency);
      return <div key={currency} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {([{ key: "finance.revenue", value: balance.revenue }, { key: "finance.expenses", value: balance.expense }, { key: "finance.balance", value: balance.balance }, { key: "finance.cash", value: balance.cashBalance }] as const).map(({ key, value }) => <div key={key} className="min-w-0 rounded-2xl bg-slate-50 p-4"><p className="text-sm text-slate-600">{t(key)}</p><strong className="mt-2 block break-words text-xl">{money(value, currency)}</strong></div>)}
        {balance.credits > 0 && <p className="text-sm text-slate-500">{t("finance.credits")}: {money(balance.credits, currency)}</p>}
      </div>;
    })}
    <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead><tr><th className="p-2">{t("finance.date")}</th><th className="p-2">{t("finance.category")}</th><th className="p-2">{t("records.description")}</th><th className="p-2">{t("records.vehicles")}</th><th className="p-2">{t("finance.amount")}</th><th className="p-2">{t("records.status")}</th><th className="p-2">{t("profile.actions")}</th></tr></thead>
      <tbody>{visible.map((row) => <tr key={row.id} className="border-t"><td className="p-2">{localizedDate(language, { dateStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(row.date))}{row.historicalDate && <small className="block text-amber-700">{t("finance.legacyDate")}</small>}</td><td className="p-2">{row.category in categoryKeys ? t(categoryKeys[row.category as keyof typeof categoryKeys]) : row.category}<small className="block text-slate-500">{enumLabel(row.type, t)}</small></td><td className="p-2">{row.label}{row.sourceKey && <small className="block text-slate-500">{t("finance.generated")}</small>}</td><td className="p-2">{data.vehicles.find((item) => item.id === row.vehicleId)?.plate ?? "—"}</td><td className="whitespace-nowrap p-2">{money(row.amountCents, row.currency)}</td><td className="p-2">{t(row.paid ? "finance.paid" : "finance.unpaid")}</td><td className="p-2"><button type="button" disabled={disabled} onClick={() => setSelected(row.id)} className="min-h-11 rounded-xl border px-3 py-2 font-semibold text-[var(--color-primary)]">{t("finance.editDelete")}</button></td></tr>)}</tbody>
    </table></div>
    {!visible.length && <p className="text-sm text-slate-500">{t("finance.empty")}</p>}
  </section>;
}

function accountingMonthDay(date: string) {
  return new Date(Date.parse(date) + 7 * 3_600_000).toISOString().slice(0, 10);
}
