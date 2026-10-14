"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import { adminErrorKey, adminRequest } from "@/lib/admin-client";

export function AccountCreationForm({ role, disabled, onCreated }: { role: "ADMIN" | "DRIVER"; disabled: boolean; onCreated: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReturnType<typeof adminErrorKey> | null>(null);
  const [created, setCreated] = useState(false);
  const driver = role === "DRIVER";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError(null);
    setCreated(false);
    try {
      await adminRequest("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, role }) });
      setForm({ name: "", email: "", password: "" });
      setCreated(true);
      onCreated();
    } catch (error) {
      setError(adminErrorKey(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={submit} className="mt-5">
        <fieldset disabled={disabled || pending} className="grid gap-3 sm:grid-cols-3">
          <input aria-label={t(driver ? "admin.driver" : "admin.administratorName")} required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={t(driver ? "admin.driver" : "admin.administratorName")} className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" />
          <input aria-label={t(driver ? "admin.driverEmail" : "admin.administratorEmail")} required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder={t(driver ? "admin.driverEmail" : "admin.administratorEmail")} className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" />
          <input aria-label={t("admin.temporaryPassword")} autoComplete="new-password" required minLength={8} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={t("admin.temporaryPassword")} className="rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm outline-none focus:border-[var(--color-primary)]" />
          <button type="submit" className="rounded-full bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-3">{pending ? t("admin.saving") : t(driver ? "admin.createDriver" : "admin.createAdministrator")}</button>
        </fieldset>
      </form>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-error)]">{t(error)}{error === "admin.sessionExpired" && <> <Link href="/auth" className="underline">{t("admin.openSignIn")}</Link></>}</p>}
      {created && <p role="status" className="mt-3 text-sm font-semibold text-emerald-700">{t(driver ? "admin.driverCreated" : "admin.administratorCreated")}</p>}
    </>
  );
}
