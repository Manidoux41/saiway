"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Building2, CheckCircle2 } from "lucide-react";
import { useLanguage, type TranslationKey } from "@/components/i18n/language-provider";
import { useAuth } from "@/components/auth/auth-provider";
import { professionalCategories } from "@/lib/professional-policy";
import { useProfessional } from "@/components/professionals/use-professional";
import { ProfessionalStatus } from "@/components/professionals/professional-status";

export default function ProfessionalsPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const { professional, loaded, error: loadError, refresh } = useProfessional();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const form = new FormData(event.currentTarget);
    setPending(true); setError(null);
    try {
      const response = await fetch("/api/professionals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(form)), signal: AbortSignal.timeout(15000) });
      if (!response.ok) {
        const body = await response.json();
        setError(body.error === "PRO_DUPLICATE" ? "pro.duplicate" : body.error === "PRO_SIGN_OUT" ? "pro.signOut" : response.status === 400 ? "pro.invalid" : "pro.error");
        return;
      }
      router.refresh();
    } catch { setError("pro.error"); } finally { setPending(false); }
  }
  return <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
    <header className="saiway-cultural-panel space-y-5 rounded-3xl bg-blue-950 p-6 text-white sm:p-10">
      <Building2 size={36} aria-hidden="true" /><p className="text-sm font-bold uppercase tracking-widest">{t("pro.eyebrow")}</p>
      <h1 className="max-w-3xl text-3xl font-black sm:text-5xl">{t("pro.title")}</h1>
      <p className="max-w-3xl text-lg leading-8 text-blue-50">{t("pro.pitch")}</p>
      <ul className="grid gap-4 pt-3 sm:grid-cols-3">{(["pro.benefit1", "pro.benefit2", "pro.benefit3"] as const).map(key => <li key={key} className="flex gap-3 rounded-2xl bg-white/10 p-4 text-sm leading-6"><CheckCircle2 size={20} className="shrink-0" aria-hidden="true" />{t(key)}</li>)}</ul>
      {!user && <a href="#professional-registration" className="inline-flex min-h-12 items-center rounded-xl bg-white px-5 py-3 font-bold text-blue-900">{t("pro.join")}</a>}
    </header>
    {user ? !loaded ? <p role={loadError ? "alert" : "status"}>{t(loadError ? "pro.error" : "admin.loading")}{loadError && <button type="button" className="ml-3 underline" onClick={refresh}>{t("admin.retry")}</button>}</p> : professional ? <><ProfessionalStatus professional={professional} /><button type="button" className="rounded-xl border p-3" onClick={refresh}>{t("admin.retry")}</button></> : <p className="rounded-xl border p-5">{t("pro.customerNotice")} <Link href="/auth" className="underline">{t("nav.account")}</Link></p> : <section id="professional-registration" className="scroll-mt-32 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 className="text-2xl font-bold">{t("pro.formTitle")}</h2><p className="my-4 max-w-3xl text-sm leading-7 text-slate-600">{t("pro.approvalHelp")}</p>
      {error && <p role="alert" className="mb-4 text-red-700">{t(error)}</p>}
      <form onSubmit={register}><fieldset disabled={pending} className="grid gap-5 sm:grid-cols-2">
        {([{ name: "companyName", key: "pro.companyName", max: 200 }, { name: "contactName", key: "pro.contactName", max: 200 }, { name: "contactPhone", key: "pro.contactPhone", type: "tel", max: 30 }, { name: "email", key: "pro.email", type: "email", max: 254 }, { name: "address", key: "pro.address", max: 500 }, { name: "password", key: "pro.password", type: "password", max: 128 }] as const).map(field => <label key={field.name} className="min-w-0 text-sm font-semibold">{t(field.key)}<input name={field.name} type={"type" in field ? field.type : "text"} required maxLength={field.max} minLength={field.name === "password" || field.name === "contactPhone" ? 8 : field.name === "address" ? 3 : field.name === "companyName" ? 2 : 1} autoComplete={field.name === "password" ? "new-password" : field.name === "email" ? "email" : undefined} className="mt-2 w-full min-w-0 rounded-xl border border-slate-300 p-3" /></label>)}
        <label className="min-w-0 text-sm font-semibold">{t("pro.category")}<select name="category" className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3">{professionalCategories.map(value => <option key={value} value={value}>{t(`pro.${value}`)}</option>)}</select></label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2"><button type="submit" className="min-h-12 rounded-xl bg-blue-900 px-5 py-3 font-bold text-white disabled:opacity-50">{t(pending ? "admin.saving" : "pro.join")}</button><Link href="/auth" className="font-semibold text-blue-900 underline">{t("pro.signIn")}</Link></div>
      </fieldset></form>
    </section>}
  </div>;
}
