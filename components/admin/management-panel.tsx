"use client";

import { FormEvent, useEffect, useState } from "react";

type ManagementData = { users: Array<{ id: string; name: string; email: string; role: string; status: string }>; vehicles: Array<{ id: string; name: string; plate: string; seats: number; active: boolean }>; entries: Array<{ id: string; type: string; label: string; amountCents: number; paidAt: string | null }>; forecasts: Array<{ id: string; month: string; expectedRevenueCents: number; expectedExpenseCents: number }>; contracts: Array<{ id: string; provider: string; monthlyCents: number; status: string; vehicle: { name: string; plate: string } }>; };

export function ManagementPanel() {
  const [data, setData] = useState<ManagementData | null>(null);
  const [vehicle, setVehicle] = useState({ name: "", plate: "", seats: "4" });
  const [entry, setEntry] = useState({ type: "REVENUE", label: "", amount: "" });
  const [forecast, setForecast] = useState({ month: "", revenue: "", expense: "" });

  function load() {
    fetch("/api/admin/management", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<ManagementData> : null)
      .then((nextData) => { if (nextData) setData(nextData); });
  }
  useEffect(() => { load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>, entity: string, payload: Record<string, unknown>, reset: () => void) {
    event.preventDefault();
    await fetch("/api/admin/management", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, data: payload }) });
    reset();
    load();
  }

  async function disable(entity: string, id: string) {
    await fetch("/api/admin/management", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ entity, id }) });
    load();
  }

  if (!data) return <section className="mt-8 rounded-[28px] bg-white p-6 shadow-sm">Loading management data...</section>;
  const revenue = data.entries.filter((item) => item.type === "REVENUE").reduce((sum, item) => sum + item.amountCents, 0);
  const expenses = data.entries.filter((item) => item.type !== "REVENUE").reduce((sum, item) => sum + item.amountCents, 0);
  const forecastRevenue = data.forecasts.reduce((sum, item) => sum + item.expectedRevenueCents, 0);
  const forecastExpenses = data.forecasts.reduce((sum, item) => sum + item.expectedExpenseCents, 0);

  return <div className="mt-8 space-y-8">
    <section className="grid gap-4 md:grid-cols-4">
      {[['Actual revenue', revenue], ['Actual expenses', expenses], ['Forecast revenue', forecastRevenue], ['Forecast balance', forecastRevenue - forecastExpenses]].map(([label, value]) => <div key={String(label)} className="rounded-3xl border border-black/5 bg-white p-5 shadow-sm"><div className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</div><div className="mt-3 text-2xl font-black text-[var(--color-primary)]">${(Number(value) / 100).toFixed(2)}</div></div>)}
    </section>

    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold text-[var(--color-text)]">Accounts and roles</h2><div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs uppercase tracking-[0.12em] text-slate-500"><tr><th className="pb-3">Name</th><th className="pb-3">Email</th><th className="pb-3">Role</th><th className="pb-3">Status</th><th className="pb-3" /></tr></thead><tbody>{data.users.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="py-3 font-semibold">{item.name}</td><td className="py-3">{item.email}</td><td className="py-3">{item.role}</td><td className="py-3">{item.status}</td><td className="py-3 text-right">{item.status !== "SUSPENDED" && <button type="button" onClick={() => disable("user", item.id)} className="text-sm font-semibold text-[var(--color-error)]">Suspend</button>}</td></tr>)}</tbody></table></div></section>

    <section className="grid gap-8 lg:grid-cols-2"><div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Fleet management</h2><form onSubmit={(event) => create(event, "vehicle", { name: vehicle.name, plate: vehicle.plate, seats: vehicle.seats }, () => setVehicle({ name: "", plate: "", seats: "4" }))} className="mt-4 grid gap-3 sm:grid-cols-3"><input required value={vehicle.name} onChange={(event) => setVehicle({ ...vehicle, name: event.target.value })} placeholder="Vehicle" className="rounded-xl border p-3" /><input required value={vehicle.plate} onChange={(event) => setVehicle({ ...vehicle, plate: event.target.value })} placeholder="Plate" className="rounded-xl border p-3" /><input required type="number" value={vehicle.seats} onChange={(event) => setVehicle({ ...vehicle, seats: event.target.value })} placeholder="Seats" className="rounded-xl border p-3" /><button className="rounded-full bg-[var(--color-primary)] p-3 text-sm font-semibold text-white sm:col-span-3">Add vehicle</button></form><div className="mt-5 space-y-2">{data.vehicles.map((item) => <div key={item.id} className="flex justify-between border-t pt-3 text-sm"><span>{item.name} · {item.plate} · {item.seats} seats</span>{item.active && <button type="button" onClick={() => disable("vehicle", item.id)} className="text-[var(--color-error)]">Disable</button>}</div>)}</div></div>

    <div className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Accounting entries</h2><form onSubmit={(event) => create(event, "accounting", { type: entry.type, label: entry.label, amountCents: Number(entry.amount) * 100 }, () => setEntry({ type: "REVENUE", label: "", amount: "" }))} className="mt-4 grid gap-3 sm:grid-cols-3"><select value={entry.type} onChange={(event) => setEntry({ ...entry, type: event.target.value })} className="rounded-xl border p-3"><option value="REVENUE">Revenue</option><option value="EXPENSE">Expense</option><option value="CREDIT">Credit</option><option value="PURCHASE">Purchase</option></select><input required value={entry.label} onChange={(event) => setEntry({ ...entry, label: event.target.value })} placeholder="Description" className="rounded-xl border p-3" /><input required type="number" step="0.01" value={entry.amount} onChange={(event) => setEntry({ ...entry, amount: event.target.value })} placeholder="USD" className="rounded-xl border p-3" /><button className="rounded-full bg-[var(--color-primary)] p-3 text-sm font-semibold text-white sm:col-span-3">Add entry</button></form><div className="mt-5 space-y-2">{data.entries.map((item) => <div key={item.id} className="flex justify-between border-t pt-3 text-sm"><span>{item.type} · {item.label}</span><span>${(item.amountCents / 100).toFixed(2)} <button type="button" onClick={() => disable("accounting", item.id)} className="ml-2 text-[var(--color-error)]">Delete</button></span></div>)}</div></div></section>

    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Forecast accounts</h2><form onSubmit={(event) => create(event, "forecast", { month: forecast.month, expectedRevenueCents: Number(forecast.revenue) * 100, expectedExpenseCents: Number(forecast.expense) * 100 }, () => setForecast({ month: "", revenue: "", expense: "" }))} className="mt-4 grid gap-3 md:grid-cols-4"><input required type="month" value={forecast.month} onChange={(event) => setForecast({ ...forecast, month: event.target.value })} className="rounded-xl border p-3" /><input required type="number" value={forecast.revenue} onChange={(event) => setForecast({ ...forecast, revenue: event.target.value })} placeholder="Expected revenue" className="rounded-xl border p-3" /><input required type="number" value={forecast.expense} onChange={(event) => setForecast({ ...forecast, expense: event.target.value })} placeholder="Expected expenses" className="rounded-xl border p-3" /><button className="rounded-full bg-[var(--color-primary)] p-3 text-sm font-semibold text-white">Add forecast</button></form><div className="mt-5 grid gap-3 md:grid-cols-3">{data.forecasts.map((item) => <div key={item.id} className="rounded-2xl bg-[var(--color-input)] p-4 text-sm"><div>{new Date(item.month).toLocaleDateString()}</div><div className="mt-2 text-emerald-700">+${(item.expectedRevenueCents / 100).toFixed(2)}</div><div className="text-[var(--color-error)]">-${(item.expectedExpenseCents / 100).toFixed(2)}</div></div>)}</div></section>
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-sm"><h2 className="text-xl font-bold">Active vehicle rentals and financing</h2><div className="mt-5 grid gap-3 md:grid-cols-3">{data.contracts.length === 0 ? <p className="text-sm text-slate-500">No active vehicle contracts recorded.</p> : data.contracts.map((item) => <div key={item.id} className="rounded-2xl bg-[var(--color-input)] p-4 text-sm"><div className="font-semibold">{item.vehicle.name} · {item.vehicle.plate}</div><div className="mt-2 text-slate-600">{item.provider}</div><div className="mt-1 font-bold text-[var(--color-primary)]">${(item.monthlyCents / 100).toFixed(2)} / month</div><div className="mt-1 text-xs text-slate-500">{item.status}</div></div>)}</div></section>
  </div>;
}
