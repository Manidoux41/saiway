"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { adminErrorKey, adminRequest, type ManagementData } from "@/lib/admin-client";

export function ManagementPanel({ data, loading, loadError, onReload }: { data: ManagementData | null; loading: boolean; loadError: ReturnType<typeof adminErrorKey> | null; onReload: () => void }) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReturnType<typeof adminErrorKey> | null>(null);
  const [saved, setSaved] = useState(false);

  async function mutate(method: "POST" | "DELETE", body: Record<string, unknown>, form?: HTMLFormElement) {
    if (pending) return;
    setPending(true); setError(null); setSaved(false);
    try {
      await adminRequest("/api/admin/management", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      form?.reset(); setSaved(true); onReload();
    } catch (error) { setError(adminErrorKey(error)); }
    finally { setPending(false); }
  }

  function create(event: FormEvent<HTMLFormElement>, entity: string) {
    event.preventDefault();
    const form = event.currentTarget;
    const input = new FormData(form);
    const data: Record<string, unknown> = Object.fromEntries(input.entries());
    if (entity === "accounting") data.amountCents = Math.round(Number(data.amount) * 100);
    if (entity === "forecast") {
      data.expectedRevenueCents = Math.round(Number(data.revenue) * 100);
      data.expectedExpenseCents = Math.round(Number(data.expense) * 100);
    }
    void mutate("POST", { entity, data }, form);
  }

  if (!data) return <section className="mt-8 rounded-[28px] bg-white p-6 shadow-sm">{t(loadError ? "admin.dataUnavailable" : "admin.loading")}</section>;
  const revenue = data.entries.filter((item) => item.type === "REVENUE" && item.currency === "USD").reduce((sum, item) => sum + item.amountCents, 0) + data.receipts.filter((item) => item.currency === "USD").reduce((sum, item) => sum + item.amountCents, 0);
  const expenses = data.entries.filter((item) => item.type !== "REVENUE").reduce((sum, item) => sum + item.amountCents, 0);
  const forecastRevenue = data.forecasts.reduce((sum, item) => sum + item.expectedRevenueCents, 0);
  const forecastExpenses = data.forecasts.reduce((sum, item) => sum + item.expectedExpenseCents, 0);
  const inputClass = "rounded-xl border p-3";
  const buttonClass = "rounded-full bg-[var(--color-primary)] p-3 text-sm font-semibold text-white";

  return <div className="mt-8 space-y-8">
    {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-[var(--color-error)]">{t(error)}{error === "admin.sessionExpired" && <> <Link href="/auth" className="underline">{t("admin.openSignIn")}</Link></>}</p>}
    {saved && <p role="status" className="text-sm font-semibold text-emerald-700">{t("admin.recordSaved")}</p>}
    <fieldset disabled={pending || loading || Boolean(loadError)} className="contents">
      <section className="grid gap-4 md:grid-cols-4">{[["Actual revenue", revenue], ["Actual expenses", expenses], ["Forecast revenue", forecastRevenue], ["Forecast balance", forecastRevenue - forecastExpenses]].map(([label, value]) => <div key={String(label)} className="rounded-3xl bg-white p-5 shadow-sm"><div className="text-sm text-slate-500">{label}</div><div className="mt-3 text-2xl font-black">${(Number(value) / 100).toFixed(2)}</div></div>)}</section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold">{t("payment.ledger")}</h2><p className="mt-2 text-sm text-slate-500">{t("payment.ledgerNotice")}</p>
        <div className="mt-4 flex flex-wrap gap-3">{[...new Set(data.receipts.map((item) => item.currency))].map((currency) => <strong key={currency} className="rounded-2xl bg-emerald-50 p-3 text-emerald-800">{new Intl.NumberFormat(language, { style: "currency", currency }).format(data.receipts.filter((item) => item.currency === currency).reduce((sum, item) => sum + item.amountCents, 0) / 100)}</strong>)}</div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>{t("customer.abaReference")}</th><th>{t("payment.receivedVia")}</th><th>{t("admin.driver")}</th><th>{t("booking.date")}</th><th>{t("customer.abaAmount")}</th></tr></thead><tbody>{data.receipts.map((receipt) => <tr key={receipt.id} className="border-t"><td className="py-3">{receipt.booking.reference}<small className="block text-slate-500">{receipt.provider} · {receipt.booking.status}</small></td><td>{receipt.collectionMethod ? t(`payment.${receipt.collectionMethod}`) : receipt.provider === "ABA_PAYWAY" ? t("payment.ABA") : t("payment.legacyMethod")}</td><td>{receipt.booking.driver?.user.name ?? "—"}</td><td>{new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(receipt.updatedAt))}</td><td>{new Intl.NumberFormat(language, { style: "currency", currency: receipt.currency }).format(receipt.amountCents / 100)}</td></tr>)}</tbody></table>{!data.receipts.length && <p className="py-4 text-slate-500">{t("payment.noReceipts")}</p>}</div>
      </section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Accounts and roles</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>{data.users.map((item) => <tr key={item.id} className="border-t"><td className="py-3">{item.name}</td><td>{item.email}</td><td>{item.role}</td><td>{item.status}</td><td>{item.status !== "SUSPENDED" && item.id !== user?.id && <button type="button" onClick={() => { if (window.confirm(t("courses.confirmArchive"))) void mutate("DELETE", { entity: "user", id: item.id }); }} className="text-[var(--color-error)]">Suspend</button>}</td></tr>)}</tbody></table></div></section>
      <section className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Fleet management</h2><form onSubmit={(event) => create(event, "vehicle")} className="mt-4 grid gap-3 sm:grid-cols-3"><input name="name" required placeholder="Vehicle" className={inputClass} /><input name="plate" required placeholder="Plate" className={inputClass} /><input name="seats" required type="number" min="1" max="50" defaultValue="4" placeholder="Seats" className={inputClass} /><button className={`${buttonClass} sm:col-span-3`}>Add vehicle</button></form><div className="mt-5 space-y-2">{data.vehicles.map((item) => <div key={item.id} className="flex justify-between border-t pt-3 text-sm"><span>{item.name} · {item.plate} · {item.seats} seats</span>{item.active && <button type="button" onClick={() => { if (window.confirm(t("courses.confirmArchive"))) void mutate("DELETE", { entity: "vehicle", id: item.id }); }} className="text-[var(--color-error)]">Disable</button>}</div>)}</div></div>
        <div className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Accounting entries</h2><form onSubmit={(event) => create(event, "accounting")} className="mt-4 grid gap-3 sm:grid-cols-3"><select name="type" className={inputClass}>{["REVENUE", "EXPENSE", "CREDIT", "PURCHASE"].map((value) => <option key={value}>{value}</option>)}</select><input name="label" required placeholder="Description" className={inputClass} /><input name="amount" required type="number" min="0" step="0.01" placeholder="USD" className={inputClass} /><button className={`${buttonClass} sm:col-span-3`}>Add entry</button></form><div className="mt-5 space-y-2">{data.entries.map((item) => <div key={item.id} className="flex justify-between border-t pt-3 text-sm"><span>{item.type} · {item.label}</span><span>${(item.amountCents / 100).toFixed(2)}</span></div>)}</div></div>
      </section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Forecast accounts</h2><form onSubmit={(event) => create(event, "forecast")} className="mt-4 grid gap-3 md:grid-cols-4"><input name="month" required type="month" className={inputClass} /><input name="revenue" required type="number" min="0" step="0.01" placeholder="Expected revenue" className={inputClass} /><input name="expense" required type="number" min="0" step="0.01" placeholder="Expected expenses" className={inputClass} /><button className={buttonClass}>Add forecast</button></form><div className="mt-5 grid gap-3 md:grid-cols-3">{data.forecasts.map((item) => <div key={item.id} className="rounded-2xl bg-[var(--color-input)] p-4 text-sm"><div>{item.month.slice(0, 7)}</div><div>+${(item.expectedRevenueCents / 100).toFixed(2)}</div><div>-${(item.expectedExpenseCents / 100).toFixed(2)}</div></div>)}</div></section>
      <section className="rounded-[28px] bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Vehicle rentals and financing</h2><div className="mt-4 grid gap-3 md:grid-cols-3">{data.contracts.map((item) => <div key={item.id} className="rounded-2xl border p-4">{item.vehicle.name} · {item.vehicle.plate}<p>{item.provider} · ${(item.monthlyCents / 100).toFixed(2)} / month · {item.status}</p></div>)}</div></section>
    </fieldset>
  </div>;
}
