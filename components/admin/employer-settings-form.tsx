"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Building2, X } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";

const keys = ["name", "registrationNo", "address", "representative", "representativeTitle"] as const;
type Employer = Record<(typeof keys)[number], string>;
const labels = { name: "profile.employerName", registrationNo: "profile.employerRegistration", address: "profile.employerAddress", representative: "profile.employerRepresentative", representativeTitle: "profile.employerRepresentativeTitle" } as const;
const fromResponse = (body: unknown): Employer | null => {
  const employer = (body as { employer?: Record<string, string | null> } | null)?.employer;
  return employer ? Object.fromEntries(keys.map((key) => [key, employer[key] ?? ""])) as Employer : null;
};

export function EmployerSettingsForm({ onChanged }: { onChanged: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState<Employer | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<"ok" | "error" | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/employer", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then(
      (body) => { if (!active) return; const employer = fromResponse(body); if (employer) setForm(employer); else setFailed(true); },
      () => { if (active) setFailed(true); },
    );
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/employer", { method: "PUT", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const employer = response.ok ? fromResponse(await response.json()) : null;
      if (!employer) throw new Error("save");
      setForm(employer);
      setFeedback("ok");
      onChanged();
    } catch {
      setFeedback("error");
    } finally {
      setPending(false);
    }
  }

  return <details className="mt-5 rounded-3xl border border-slate-200 bg-white p-5">
    <summary className="flex cursor-pointer items-center gap-2 text-base font-bold"><Building2 size={18} aria-hidden="true" />{t("profile.employer")}</summary>
    <p className="mt-2 text-sm text-slate-500">{t("profile.employerHelp")}</p>
    {failed && <p role="alert" className="mt-3 text-sm font-semibold text-[var(--color-error)]">{t("profile.loadError")}</p>}
    {form && <form onSubmit={submit} className="mt-4"><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      {keys.map((key) => <label key={key} className={`grid gap-1 text-sm font-medium text-slate-700 ${key === "address" ? "sm:col-span-2" : ""}`}>{t(labels[key])}
        <span className="flex items-start gap-1.5">
          <input value={form[key]} maxLength={key === "address" ? 500 : 200} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]" />
          {form[key] && <button type="button" onClick={() => setForm({ ...form, [key]: "" })} aria-label={`${t("profile.clear")} · ${t(labels[key])}`} title={t("profile.clear")} className="mt-1.5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[var(--color-error)]"><X size={15} aria-hidden="true" /></button>}
        </span>
      </label>)}
      <div className="sm:col-span-2"><button type="submit" className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? t("profile.saving") : t("profile.save")}</button></div>
    </fieldset></form>}
    {feedback && <p role={feedback === "ok" ? "status" : "alert"} className={`mt-3 text-sm font-semibold ${feedback === "ok" ? "text-emerald-700" : "text-[var(--color-error)]"}`}>{t(feedback === "ok" ? "profile.saved" : "profile.saveError")}</p>}
  </details>;
}
