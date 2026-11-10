"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { payrollListSchema } from "@/lib/payroll-client";
import { localizedDate, localizedNumber } from "@/lib/locale-format";
import { z } from "zod";
import { useListSort } from "@/components/admin/list-sort";
import { sortDate } from "@/lib/list-sort";

export function PayrollPanel({ admin = false, onChanged }: { admin?: boolean; onChanged?: () => void }) {
  const { t, language } = useLanguage();
  const [month, setMonth] = useState(() => {
    const now = new Date(Date.now() + 7 * 3_600_000);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  });
  const [data, setData] = useState<z.infer<typeof payrollListSchema> | null>(null);
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"payroll.error" | "payroll.conflict" | null>(null);
  const [saved, setSaved] = useState(false);
  const [payDates, setPayDates] = useState<Record<string, string>>({});
  const [selectedDriver, setSelectedDriver] = useState("");
  const payrolls = useListSort(data?.payrolls ?? [], [
    { key: "date", label: t("payroll.schedule"), value: (item) => sortDate(item.scheduledPayAt) },
    { key: "name", label: t("payroll.driver"), value: (item) => item.snapshot.employeeName },
    { key: "month", label: t("records.month"), value: (item) => item.month },
    { key: "status", label: t("records.status"), value: (item) => t(`payroll.${item.status}`) },
    { key: "amount", label: t("payroll.net"), value: (item) => item.netCents },
  ], { key: "date", direction: "desc" });
  const endpoint = admin ? "/api/admin/payroll" : "/api/driver/payroll";
  useEffect(() => {
    const controller = new AbortController();
    fetch(admin ? `${endpoint}?month=${encodeURIComponent(month)}` : endpoint, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Payroll unavailable"); return payrollListSchema.parse(await response.json()); })
      .then((value) => { if (!controller.signal.aborted) { setData(value); setError(null); } }).catch(() => { if (!controller.signal.aborted) setError("payroll.error"); });
    return () => controller.abort();
  }, [endpoint, month, revision, admin]);
  async function mutate(body: Record<string, unknown>, method: "POST" | "PATCH") {
    if (pending) return;
    setPending(true); setError(null); setSaved(false);
    try {
      const response = await fetch(endpoint, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) { setError(response.status === 409 ? "payroll.conflict" : "payroll.error"); return; }
      setRevision((value) => value + 1); setSaved(true); onChanged?.();
    } catch { setError("payroll.error"); } finally { setPending(false); }
  }
  function draft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void mutate({ driverId: String(form.get("driverId")), month, bonusCents: Math.round(Number(form.get("bonus") || 0) * 100), deductionCents: Math.round(Number(form.get("deduction") || 0) * 100), adjustmentNotes: String(form.get("notes") || "") }, "POST");
  }
  const input = "mt-1 w-full min-w-0 rounded-xl border bg-white p-3";
  const button = "rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50";
  const money = (value: number) => localizedNumber(language, { style: "currency", currency: "USD" }).format(value / 100);
  const selectedPayroll = data?.payrolls.find((payroll) => payroll.driverId === selectedDriver);
  return <section className="my-6 min-w-0 space-y-4 rounded-[28px] bg-white p-5 shadow-sm sm:p-6">
    <h2 className="text-xl font-bold">{t("payroll.title")}</h2><p className="text-sm leading-6 text-slate-600">{t("payroll.help")}</p>
    {error && <p role="alert" className="text-red-700">{t(error)}</p>}{saved && <p role="status" className="text-emerald-700">{t("payroll.saved")}</p>}
    <button type="button" disabled={pending} onClick={() => setRevision((value) => value + 1)} className={button}>{t("admin.retry")}</button>
    {admin && <><label className="block max-w-sm">{t("records.month")}<input type="month" value={month} required onChange={(event) => { if (event.target.value) { setMonth(event.target.value); setData(null); } }} className={input} /></label>
      <form onSubmit={draft} key={`${month}:${selectedDriver}:${selectedPayroll?.updatedAt ?? ""}`}><fieldset disabled={pending || !data} className="grid gap-4 sm:grid-cols-2">
        <label>{t("payroll.driver")}<select name="driverId" value={selectedDriver} onChange={(event) => setSelectedDriver(event.target.value)} required className={input}><option value="">{t("courses.select")}</option>{data?.drivers?.map((driver) => <option key={driver.id} value={driver.id}>{driver.user.name}</option>)}</select></label>
        <label>{t("payroll.bonus")}<input name="bonus" type="number" min="0" max="1000000" step="0.01" defaultValue={(selectedPayroll?.bonusCents ?? 0) / 100} className={input} /></label>
        <label>{t("payroll.deduction")}<input name="deduction" type="number" min="0" max="1000000" step="0.01" defaultValue={(selectedPayroll?.deductionCents ?? 0) / 100} className={input} /></label>
        <label>{t("payroll.notes")}<textarea name="notes" rows={2} maxLength={2000} defaultValue={selectedPayroll?.adjustmentNotes ?? ""} className={input} /></label>
        <button disabled={Boolean(selectedPayroll && selectedPayroll.status !== "DRAFT")} className={button}>{t("payroll.draft")}</button>
      </fieldset></form></>}
    {!data && !error && <p role="status">{t("admin.loading")}</p>}
    {admin && payrolls.controls}
    {(admin ? payrolls.items : data?.payrolls ?? []).map((payroll) => <article key={payroll.id} className="min-w-0 space-y-3 rounded-2xl border p-4">
      <h3 className="text-lg font-bold">{payroll.snapshot.employeeName} · {payroll.month}</h3><p className="text-sm">{t(`payroll.${payroll.status}`)}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {([{ label: "payroll.base", value: payroll.baseSalaryCents }, { label: "payroll.revenue", value: payroll.eligibleRevenueCents }, { label: "payroll.commission", value: payroll.commissionCents }, { label: "payroll.bonus", value: payroll.bonusCents }, { label: "payroll.deduction", value: payroll.deductionCents }, { label: "payroll.net", value: payroll.netCents }] as const).map(({ label, value }) => <div key={label}><dt className="text-sm text-slate-600">{t(label)}</dt><dd className="font-bold">{money(value)}</dd></div>)}
      </dl>
      <p className="text-sm">{t("payroll.schedule")}: {localizedDate(language, { dateStyle: "long", timeZone: "Asia/Phnom_Penh" }).format(new Date(payroll.scheduledPayAt))}</p>
      <p className="text-xs text-amber-700">{t("payroll.unpaid")}: {payroll.snapshot.unpaidTrips} · {t("payroll.undated")}: {payroll.snapshot.undatedTrips}</p>
      {payroll.adjustmentNotes && <p className="whitespace-pre-wrap break-words text-sm">{payroll.adjustmentNotes}</p>}
      <details><summary className="cursor-pointer text-sm font-semibold">{t("payroll.sources")}</summary>{payroll.snapshot.sources.map((source) => <p key={source.reference} className="mt-2 break-words text-xs">{source.reference} · {money(source.amountCents)}{source.payments.some((payment) => payment.historicalDate) && ` · ${t("payroll.legacy")}`}</p>)}</details>
      <div className="flex flex-wrap items-end gap-3">
        <a href={`${endpoint}/${encodeURIComponent(payroll.id)}/pdf?language=${language}`} className={button} target="_blank" rel="noopener noreferrer">{t("payroll.pdf")}</a>
        {admin && payroll.status === "DRAFT" && <button type="button" disabled={pending} className={button} onClick={() => { if (window.confirm(t("payroll.confirm"))) void mutate({ id: payroll.id, action: "FINALIZE", expectedUpdatedAt: payroll.updatedAt }, "PATCH"); }}>{t("payroll.finalize")}</button>}
        {admin && payroll.status === "FINALIZED" && <><label className="min-w-0">{t("payroll.payDate")}<input type="datetime-local" value={payDates[payroll.id] ?? ""} onChange={(event) => setPayDates((previous) => ({ ...previous, [payroll.id]: event.target.value }))} className={input} /></label><button type="button" disabled={pending || !payDates[payroll.id]} className={button} onClick={() => void mutate({ id: payroll.id, action: "PAID", paidAt: new Date(`${payDates[payroll.id]}:00+07:00`).toISOString() }, "PATCH")}>{t("payroll.paid")}</button></>}
      </div>
    </article>)}
    {data && !data.payrolls.length && <p>{t("payroll.empty")}</p>}
    <p className="text-xs leading-6 text-slate-500">{t("payroll.manual")}</p>
  </section>;
}
