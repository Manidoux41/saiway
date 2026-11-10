"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { driverVehicleExpensesResponseSchema, type VehicleExpenseView, type VehicleExpenseVehicle } from "@/lib/vehicle-expense-client";
import { convertedUsdCents, parseAmountInput } from "@/lib/vehicle-expense-policy";
import { localizedDate, localizedNumber } from "@/lib/locale-format";
import { useListSort } from "@/components/admin/list-sort";
import { sortDate } from "@/lib/list-sort";

export function VehicleExpenses({ admin = false, onChanged }: { admin?: boolean; onChanged?: () => void }) {
  const { t, language } = useLanguage();
  const endpoint = admin ? "/api/admin/vehicle-expenses" : "/api/driver/vehicle-expenses";
  const [data, setData] = useState<{ vehicles: VehicleExpenseVehicle[]; expenses: VehicleExpenseView[] } | null>(null);
  const [error, setError] = useState<"fuel.error" | "fuel.conflict" | null>(null);
  const [saved, setSaved] = useState<"fuel.saved" | "fuel.reviewed" | null>(null);
  const [pending, setPending] = useState(false);
  const [currency, setCurrency] = useState<"USD" | "KHR">("USD");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const sorted = useListSort(data?.expenses ?? [], [
    { key: "date", label: t("finance.date"), value: (item) => sortDate(item.occurredAt) },
    { key: "category", label: t("finance.category"), value: (item) => t(item.category === "FUEL" ? "finance.FUEL" : "finance.MAINTENANCE") },
    { key: "status", label: t("records.status"), value: (item) => t(`fuel.${item.status}`) },
    { key: "vehicle", label: t("fuel.vehicle"), value: (item) => item.vehicle.plate },
    { key: "amount", label: `${t("finance.amount")} (USD)`, value: (item) => item.usdCents },
    { key: "odometer", label: t("fuel.odometer"), value: (item) => Number(item.odometerKm) },
  ], { key: "date", direction: "desc" });
  const attempt = useRef<{ signature: string; id: string } | null>(null);
  const reload = useCallback(() => fetch(endpoint, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) throw new Error("Expenses unavailable");
      return driverVehicleExpensesResponseSchema.parse(await response.json());
    })
    .then((value) => { setData(value); setError(null); return true; })
    .catch(() => { setError("fuel.error"); return false; }), [endpoint]);
  useEffect(() => { void reload(); }, [reload]);
  async function send(body: Record<string, unknown>, method: "POST" | "PATCH") {
    if (pending) return false;
    setPending(true); setError(null); setSaved(null);
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { setError(response.status === 409 ? "fuel.conflict" : "fuel.error"); return false; }
      onChanged?.();
      if (!await reload()) return false;
      setSaved(method === "POST" ? "fuel.saved" : "fuel.reviewed"); return true;
    } catch { setError("fuel.error"); return false; } finally { setPending(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const value = (key: string) => String(values.get(key) ?? "");
    const amountCents = parseAmountInput(value("amount"), currency);
    const rate = currency === "KHR" ? value("khrPerUsd") : null;
    const usdCents = amountCents === null ? null : convertedUsdCents(amountCents, currency, rate);
    const date = value("date");
    if (amountCents === null || usdCents === null || !date) { setError("fuel.error"); return; }
    const body = { vehicleId: value("vehicleId"), occurredAt: new Date(`${date}:00+07:00`).toISOString(), odometerKm: value("odometerKm"), amountCents, currency, khrPerUsd: rate, notes: value("notes"), ...(!admin ? { liters: value("liters"), fullTank: values.get("fullTank") === "on" } : {}) };
    const signature = JSON.stringify(body);
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    if (await send({ ...body, requestId: attempt.current.id }, "POST")) { attempt.current = null; form.reset(); setCurrency("USD"); }
  }
  const input = "mt-1 w-full min-w-0 rounded-xl border bg-white p-3";
  const button = "rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
  const money = (expense: VehicleExpenseView) => localizedNumber(language, { style: "currency", currency: expense.currency }).format(expense.amountCents / (expense.currency === "USD" ? 100 : 1));
  return <section className="my-6 min-w-0 space-y-4 rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t(admin ? "fuel.adminTitle" : "fuel.title")}</h2><button type="button" className={button} disabled={pending} onClick={() => void reload()}>{t("admin.retry")}</button></div>
    <p className="text-sm leading-6 text-slate-600">{t("fuel.help")}</p>
    {error && <p role="alert" className="text-red-700">{t(error)}</p>}
    {saved && <p role="status" className="text-emerald-700">{t(saved)}</p>}
    {!data && !error && <p role="status">{t("admin.loading")}</p>}
    {data && <><h3 className="font-semibold">{t(admin ? "fuel.maintenance" : "fuel.title")}</h3>
      {!data.vehicles.some((vehicle) => vehicle.active) && <p>{t("fuel.noVehicle")}</p>}
      <form onSubmit={submit}><fieldset disabled={pending || !data.vehicles.some((vehicle) => vehicle.active)} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label>{t("fuel.vehicle")}<select name="vehicleId" required className={input}><option value="">{t("courses.select")}</option>{data.vehicles.filter((vehicle) => vehicle.active).map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.name} · {vehicle.plate}</option>)}</select></label>
        <label>{t("finance.date")}<input name="date" type="datetime-local" required className={input} /></label>
        <label>{t("fuel.odometer")}<input name="odometerKm" type="number" min="0" step="0.1" max="99999999999.9" required className={input} /></label>
        {!admin && <label>{t("fuel.liters")}<input name="liters" type="number" min="0.001" step="0.001" max="9999999.999" required className={input} /></label>}
        <label>{t("fuel.total")} ({currency})<input name="amount" type="number" min={currency === "USD" ? "0.01" : "1"} step={currency === "USD" ? "0.01" : "1"} required className={input} /></label>
        <label>USD / KHR<select value={currency} onChange={(event) => setCurrency(event.target.value === "KHR" ? "KHR" : "USD")} className={input}><option>USD</option><option>KHR</option></select></label>
        {currency === "KHR" && <label>{t("fuel.rate")}<input name="khrPerUsd" type="number" min="0.0001" step="0.0001" required className={input} /></label>}
        <label>{t("finance.notes")}<input name="notes" maxLength={500} required={admin} className={input} /></label>
        {!admin && <label className="flex items-center gap-3 text-sm"><input name="fullTank" type="checkbox" className="h-5 w-5 shrink-0" />{t("fuel.full")}</label>}
        <button className={button}>{t("fuel.save")}</button>
      </fieldset></form>
      <p className="text-xs leading-6 text-slate-500">{t("fuel.notice")}</p>
      <h3 className="font-semibold">{t("fuel.history")}</h3>
      <div className="grid gap-3 sm:grid-cols-2"><label>{t("fuel.vehicle")}<select value={vehicleFilter} onChange={(event) => setVehicleFilter(event.target.value)} className={input}><option value="">{t("records.all")}</option>{data.vehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.plate}</option>)}</select></label><label>{t("records.status")}<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={input}><option value="">{t("records.all")}</option>{(["PENDING", "APPROVED", "REJECTED"] as const).map((status) => <option key={status} value={status}>{t(`fuel.${status}`)}</option>)}</select></label></div>
      {admin && sorted.controls}
      {(admin ? sorted.items : data.expenses).filter((expense) => (!vehicleFilter || expense.vehicleId === vehicleFilter) && (!statusFilter || expense.status === statusFilter)).map((expense) => <article key={expense.id} className="min-w-0 space-y-2 rounded-2xl border p-4">
        <h4 className="font-semibold">{expense.vehicle.plate} · {t(expense.category === "FUEL" ? "finance.FUEL" : "finance.MAINTENANCE")}</h4>
        <p className="text-sm">{localizedDate(language, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(expense.occurredAt))} · {expense.odometerKm} km · {t(`fuel.${expense.status}`)}</p>
        <p>{money(expense)}{expense.liters && <> · {expense.liters} L · {t("fuel.unit")}: {localizedNumber(language, { style: "currency", currency: expense.currency }).format(expense.amountCents / (expense.currency === "USD" ? 100 : 1) / Number(expense.liters))}/L</>}</p>
        {expense.currency === "KHR" && <p className="text-xs">{t("fuel.conversion")}: {localizedNumber(language, { style: "currency", currency: "USD" }).format(expense.usdCents / 100)} · {expense.khrPerUsd} KHR/USD</p>}
        {expense.notes && <p className="break-words text-sm">{expense.notes}</p>}
        {admin && expense.status === "PENDING" && <div className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1">{t("fuel.reason")}<input maxLength={500} value={reasons[expense.id] ?? ""} onChange={(event) => setReasons((previous) => ({ ...previous, [expense.id]: event.target.value }))} className={input} /></label><button type="button" disabled={pending} className={button} onClick={() => void send({ id: expense.id, action: "APPROVE" }, "PATCH")}>{t("fuel.approve")}</button><button type="button" disabled={pending || !reasons[expense.id]?.trim()} className={button} onClick={() => void send({ id: expense.id, action: "REJECT", reason: reasons[expense.id] }, "PATCH")}>{t("fuel.reject")}</button></div>}
      </article>)}
      {!data.expenses.length && <p className="text-sm">{t("fuel.empty")}</p>}
    </>}
  </section>;
}
