"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/auth-provider";

export default function AccountPage() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: "", phone: "", address: "", paymentBrand: "", paymentLast4: "" });
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/account/profile", { cache: "no-store" }).then(async (response) => { if (response.ok) { const data = await response.json(); setForm({ name: data.name || "", phone: data.phone || "", address: data.customer?.address || "", paymentBrand: data.customer?.paymentBrand || "", paymentLast4: data.customer?.paymentLast4 || "" }); } });
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/account/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setMessage(response.ok ? "Account updated." : "Unable to update account.");
  }

  if (!user || user.role !== "customer") return <div className="mx-auto max-w-xl px-4 py-20 text-center"><h1 className="text-3xl font-black">Customer account required</h1><Link href="/auth" className="mt-6 inline-flex rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">Sign in</Link></div>;

  return <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8"><section className="rounded-[32px] border border-black/5 bg-white p-6 shadow-sm md:p-8"><p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">My account</p><h1 className="mt-3 text-4xl font-black text-[var(--color-text)]">Personal information</h1><p className="mt-3 text-sm text-slate-600">You can update your name, phone, address and saved payment reference. Card numbers are never stored by SAIWAY.</p><form onSubmit={save} className="mt-8 space-y-5"><label className="block text-sm font-semibold">Name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 font-normal" /></label><label className="block text-sm font-semibold">Phone<input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 font-normal" /></label><label className="block text-sm font-semibold">Address<textarea value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} className="mt-2 w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 font-normal" /></label><div className="grid gap-5 sm:grid-cols-2"><label className="block text-sm font-semibold">Payment brand<input value={form.paymentBrand} onChange={(event) => setForm({ ...form, paymentBrand: event.target.value })} placeholder="Visa, Mastercard..." className="mt-2 w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 font-normal" /></label><label className="block text-sm font-semibold">Last four digits<input inputMode="numeric" maxLength={4} value={form.paymentLast4} onChange={(event) => setForm({ ...form, paymentLast4: event.target.value })} placeholder="1234" className="mt-2 w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 font-normal" /></label></div><button type="submit" className="rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white">Save changes</button></form>{message && <p className="mt-4 text-sm font-semibold text-[var(--color-primary)]">{message}</p>}</section></div>;
}
