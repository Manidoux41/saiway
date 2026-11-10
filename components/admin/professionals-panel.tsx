"use client";

import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { useLanguage, type TranslationKey } from "@/components/i18n/language-provider";
import { professionalCategories, professionalSchema, professionalStatuses } from "@/lib/professional-policy";
import { useListSort } from "@/components/admin/list-sort";
import { sortDate } from "@/lib/list-sort";

const itemSchema = professionalSchema.extend({ user: z.object({ id: z.string(), name: z.string(), email: z.string(), status: z.string(), _count: z.object({ bookings: z.number() }) }) });
type Item = z.infer<typeof itemSchema>;

export function ProfessionalsPanel() {
  const { t } = useLanguage();
  const [items, setItems] = useState<Item[]>([]);
  const [revision, setRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Item | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/professionals", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Registrations unavailable");
        const result = z.object({ professionals: z.array(itemSchema) }).parse(await response.json());
        setItems(result.professionals); setLoaded(true); setError(null);
      } catch { if (!controller.signal.aborted) setError("pro.error"); }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  const sorted = useListSort(items.filter(item => (!filter || item.status === filter) && [item.companyName, item.contactName, item.user.email, item.address].join(" ").toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), [
    { key: "created", label: t("sorting.created"), value: item => sortDate(item.createdAt) },
    { key: "company", label: t("pro.companyName"), value: item => item.companyName },
    { key: "category", label: t("pro.category"), value: item => t(`pro.${item.category}`) },
    { key: "status", label: t("pro.status"), value: item => t(`pro.${item.status}`) },
  ], { key: "created", direction: "desc" });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !selected) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true); setError(null); setSaved(false);
    try {
      const response = await fetch(`/api/admin/professionals/${encodeURIComponent(selected.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, updatedAt: selected.updatedAt }) });
      if (!response.ok) { setError(response.status === 409 ? "pro.conflict" : response.status === 400 ? "pro.invalid" : "pro.error"); return; }
      const result = z.object({ professional: itemSchema }).parse(await response.json());
      setItems(current => current.map(item => item.id === result.professional.id ? result.professional : item));
      setSelected(null); setSaved(true);
    } catch { setError("pro.error"); } finally { setPending(false); }
  }
  return <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <header className="flex flex-wrap justify-between gap-3"><div><h2 className="text-2xl font-bold">{t("pro.admin")}</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{t("pro.adminHelp")}</p></div><button type="button" disabled={pending} className="rounded-xl border px-4 py-3" onClick={() => { setSelected(null); setRevision(value => value + 1); }}>{t("admin.retry")}</button></header>
    {error && <p role="alert" className="text-red-700">{t(error)}</p>}{saved && <p role="status" className="text-emerald-700">{t("pro.saved")}</p>}
    <div className="flex flex-wrap gap-3"><input type="search" aria-label={t("pro.companyName")} placeholder={t("pro.companyName")} value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 rounded-xl border p-3" /><select aria-label={t("pro.status")} value={filter} onChange={event => setFilter(event.target.value)} className="max-w-full rounded-xl border bg-white p-3"><option value="">{t("records.all")}</option>{professionalStatuses.map(status => <option key={status} value={status}>{t(`pro.${status}`)}</option>)}</select></div>
    {sorted.controls}
    {!loaded && !error && <p role="status">{t("admin.loading")}</p>}
    {loaded && !sorted.items.length && <p>{t("pro.empty")}</p>}
    <div className="grid gap-3 lg:grid-cols-2">{sorted.items.map(item => <article key={item.id} className="min-w-0 space-y-2 break-words rounded-2xl border p-4">
      <h3 className="text-lg font-bold">{item.companyName}</h3><p className="text-sm">{t(`pro.${item.status}`)} · {t(`pro.${item.category}`)}</p><p>{item.contactName} · {item.contactPhone}</p><p className="text-sm">{item.user.email}</p><p className="text-sm text-slate-600">{item.address}</p><p className="text-sm">{t("customer.trips")} : {item.user._count.bookings}</p>
      <button type="button" disabled={pending} className="min-h-11 rounded-xl border px-4 py-2 font-semibold text-blue-900" onClick={() => { setSelected(item); setSaved(false); }}>{t("profile.edit")}</button>
    </article>)}</div>
    {selected && <form key={`${selected.id}-${selected.updatedAt}`} onSubmit={save} className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><h3 className="mb-4 text-xl font-bold">{selected.companyName}</h3><fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
      {(["companyName", "contactName", "contactPhone", "address"] as const).map(name => <label key={name} className="min-w-0 text-sm font-semibold">{t(`pro.${name}`)}<input name={name} type={name === "contactPhone" ? "tel" : "text"} required maxLength={name === "address" ? 500 : name === "contactPhone" ? 30 : 200} defaultValue={selected[name]} className="mt-2 w-full min-w-0 rounded-xl border bg-white p-3" /></label>)}
      <label className="min-w-0 text-sm font-semibold">{t("pro.category")}<select name="category" defaultValue={selected.category} className="mt-2 w-full rounded-xl border bg-white p-3">{professionalCategories.map(value => <option key={value} value={value}>{t(`pro.${value}`)}</option>)}</select></label>
      <label className="min-w-0 text-sm font-semibold">{t("pro.status")}<select name="status" defaultValue={selected.status} className="mt-2 w-full rounded-xl border bg-white p-3">{professionalStatuses.map(value => <option key={value} value={value}>{t(`pro.${value}`)}</option>)}</select></label>
      <div className="flex flex-wrap gap-3 sm:col-span-2"><button type="submit" className="rounded-xl bg-blue-900 px-4 py-3 font-bold text-white">{t(pending ? "admin.saving" : "courses.save")}</button><button type="button" className="rounded-xl border px-4 py-3" onClick={() => setSelected(null)}>{t("push.closed")}</button></div>
    </fieldset></form>}
  </section>;
}
