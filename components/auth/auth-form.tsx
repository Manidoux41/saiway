"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/i18n/language-provider";
import { roleHome } from "@/lib/roles";
import { z } from "zod";

export default function AuthPage() {
  const [isRegistering, setIsRegistering] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email")).trim().toLowerCase();
    const password = String(formData.get("password"));
    if (pending) return;
    setPending(true); setError("");
    try {
      const response = await fetch(isRegistering ? "/api/auth/register" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      body: JSON.stringify(isRegistering ? { name: String(formData.get("name")), email, password } : { email, password }),
      });
      if (!response.ok) {
        setError(t(response.status >= 500 ? "auth.serviceUnavailable" : isRegistering && response.status === 409 ? "customer.emailExists" : isRegistering && response.status === 400 ? "customer.invalidRegistration" : "auth.accountMissing"));
        return;
      }
      const data = z.object({ user: z.object({ id: z.string(), name: z.string(), email: z.email(), role: z.enum(["customer", "driver", "admin"]) }) }).parse(await response.json());
      router.replace(roleHome(data.user.role));
      router.refresh();
    } catch { setError(t("auth.serviceUnavailable")); }
    finally { setPending(false); }
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
          <h2 className="mt-8 text-3xl font-black text-[var(--color-text)]">{isRegistering ? t("auth.create") : t("auth.welcome")}</h2>
          <p className="mt-2 text-slate-600">{isRegistering ? t("auth.customerHelp") : t("auth.loginHelp")}</p>

          <form onSubmit={submit} className="mt-8 space-y-5">
            {error && <p role="alert" className="text-[var(--color-error)]">{error}</p>}
            <fieldset disabled={pending} className="space-y-5">
              {isRegistering && <div><label htmlFor="name" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("auth.fullName")}</label><input id="name" name="name" autoComplete="name" required maxLength={200} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 outline-none focus:border-[var(--color-primary)]" /></div>}
              <div><label htmlFor="auth-email" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">Email</label><input id="auth-email" name="email" type="email" required className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 outline-none focus:border-[var(--color-primary)]" /></div>
              <div><label htmlFor="auth-password" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("auth.password")}</label><input id="auth-password" name="password" type="password" autoComplete={isRegistering ? "new-password" : "current-password"} minLength={8} maxLength={isRegistering ? 128 : undefined} required className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3.5 outline-none focus:border-[var(--color-primary)]" /></div>
                <button type="submit" className="w-full rounded-full bg-[var(--color-primary)] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]">{pending ? t("admin.saving") : isRegistering ? t("auth.createButton") : t("auth.signIn")}</button>
            </fieldset>
          </form>
              <p className="mt-4 text-xs text-slate-500">{t("auth.roleDetected")}</p>
              <button type="button" disabled={pending} onClick={() => { setIsRegistering((current) => !current); setError(""); }} className="mt-6 text-sm font-semibold text-[var(--color-primary)] hover:underline">{isRegistering ? t("auth.switchSignIn") : t("auth.switchRegister")}</button>
          <div className="mt-6"><Link href="/" className="text-sm text-slate-500 hover:text-[var(--color-primary)]">{t("auth.home")}</Link></div>
        </section>
      </div>
    </div>
  );
}
