"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { z } from "zod";
import { useLanguage } from "@/components/i18n/language-provider";

export function ChangePasswordForm() {
  const { t } = useLanguage();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<"password.invalid" | "password.incorrect" | "password.forbidden" | "password.conflict" | "password.unavailable" | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null); setSaved(false);
    if (form.newPassword !== form.confirmPassword || form.newPassword === form.currentPassword) { setError("password.invalid"); return; }
    setPending(true);
    try {
      const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form), cache: "no-store" });
      if (!response.ok) {
        const result = z.object({ error: z.string() }).parse(await response.json());
        setError(response.status === 403 ? "password.forbidden" : response.status === 409 ? "password.conflict" : result.error === "INCORRECT_PASSWORD" ? "password.incorrect" : response.status === 400 ? "password.invalid" : "password.unavailable");
        return;
      }
      z.object({ ok: z.literal(true) }).parse(await response.json());
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSaved(true);
    } catch { setError("password.unavailable"); }
    finally { setPending(false); }
  }

  return <section className="mt-8 rounded-[28px] bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold">{t("password.title")}</h2>
    <p className="mt-2 text-sm text-slate-600">{t("password.help")}</p>
    <form onSubmit={submit} className="mt-4">
      <fieldset disabled={pending} className="grid gap-4 md:grid-cols-3">
        <label>{t("password.current")}<input name="currentPassword" type="password" required maxLength={1024} autoComplete="current-password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("password.new")}<input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label>
        <label>{t("password.confirm")}<input name="confirmPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} className="mt-1 w-full rounded-xl border p-3" /></label>
        <button type="submit" className="rounded-full bg-[var(--color-primary)] p-3 font-semibold text-white md:col-span-3">{t(pending ? "admin.saving" : "password.save")}</button>
      </fieldset>
    </form>
    {error && <p role="alert" className="mt-3 text-[var(--color-error)]">{t(error)}{error === "password.forbidden" && <> <Link href="/auth" className="underline">{t("admin.openSignIn")}</Link></>}</p>}
    {saved && <p role="status" className="mt-3 font-semibold text-emerald-700">{t("password.saved")}</p>}
  </section>;
}
