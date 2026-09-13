"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth, type UserRole } from "@/components/auth/auth-provider";
import { useLanguage } from "@/components/i18n/language-provider";

export default function AuthPage() {
  const [mode, setMode] = useState<UserRole>("customer");
  const [isRegistering, setIsRegistering] = useState(true);
  const router = useRouter();
  const { signIn } = useAuth();
  const { t } = useLanguage();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim().toLowerCase();
    const password = String(formData.get("password"));
    const response = await fetch(isRegistering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isRegistering ? { name: String(formData.get("name")), email, password } : { email, password, role: mode }),
      });
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      window.alert(data.error || t("auth.accountMissing"));
      return;
    }

    const data = await response.json() as { user: { id: string; name: string; email: string; role: UserRole } };
    signIn(data.user);
    if (mode === "admin") {
      window.location.assign("/admin");
      return;
    }
    if (mode === "driver") {
      window.location.assign("/driver");
      return;
    }
    if (mode === "customer" && isRegistering) {
      router.push("/booking");
      return;
    }
    window.location.assign("/booking");
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-[30px] bg-[var(--color-primary-dark)] p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{t("auth.account")}</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">{t("auth.title")}</h1>
          <p className="mt-5 leading-7 text-white/75">{t("auth.description")}</p>
          <div className="mt-8 space-y-3 text-sm text-white/85"><div>✓ {t("auth.history")}</div><div>✓ {t("auth.alerts")}</div><div>✓ {t("auth.secure")}</div></div>
        </aside>

        <section className="rounded-[30px] border border-black/5 bg-white p-6 shadow-sm md:p-8">
          <div className="flex rounded-2xl bg-[var(--color-background)] p-1">
            <button type="button" onClick={() => { setMode("customer"); setIsRegistering(true); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${mode === "customer" ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-500"}`}>{t("auth.customer")}</button>
            <button type="button" onClick={() => { setMode("driver"); setIsRegistering(false); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${mode === "driver" ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-500"}`}>{t("auth.driver")}</button>
            <button type="button" onClick={() => { setMode("admin"); setIsRegistering(false); }} className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold ${mode === "admin" ? "bg-white text-[var(--color-primary)] shadow-sm" : "text-slate-500"}`}>{t("auth.admin")}</button>
          </div>
          <h2 className="mt-8 text-3xl font-black text-[var(--color-text)]">{isRegistering ? t("auth.create") : t("auth.welcome")}</h2>
          <p className="mt-2 text-slate-600">{mode === "driver" ? t("auth.driverHelp") : mode === "admin" ? t("auth.adminHelp") : t("auth.customerHelp")}</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
              {(isRegistering || mode === "admin") && <div><label htmlFor="name" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("auth.fullName")}</label><input id="name" name="name" required className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 outline-none focus:border-[var(--color-primary)]" /></div>}
              <div><label htmlFor="auth-email" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Email</label><input id="auth-email" name="email" type="email" required className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 outline-none focus:border-[var(--color-primary)]" /></div>
              <div><label htmlFor="auth-password" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("auth.password")}</label><input id="auth-password" name="password" type="password" minLength={8} required className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 outline-none focus:border-[var(--color-primary)]" /></div>
              <button type="submit" className="w-full rounded-full bg-[var(--color-primary)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]">{isRegistering ? t("auth.createButton") : t("auth.signIn")}</button>
          </form>
          {mode === "customer" && <button type="button" onClick={() => { setIsRegistering((current) => !current); }} className="mt-6 text-sm font-semibold text-[var(--color-primary)] hover:underline">{isRegistering ? t("auth.switchSignIn") : t("auth.switchRegister")}</button>}
          <div className="mt-6"><Link href="/" className="text-sm text-slate-500 hover:text-[var(--color-primary)]">{t("auth.home")}</Link></div>
        </section>
      </div>
    </div>
  );
}
