"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { advertisingContractSchema, advertisingInputSchema, advertisingPlacements, advertisingStatuses, type AdvertisingContract, type AdvertisingInput } from "@/lib/advertising-client";
import { AdvertisingImage } from "@/components/advertising/advertising-slots";
import { useLanguage, type TranslationKey } from "@/components/i18n/language-provider";
import { useListSort } from "@/components/admin/list-sort";
import { sortDate } from "@/lib/list-sort";
import { prepareBlogImage } from "@/lib/blog-image-client";

const fieldClass = "w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 text-slate-900";
const buttonClass = "inline-flex min-h-11 items-center justify-center rounded-xl border bg-white px-4 py-2 text-sm font-semibold text-blue-900 disabled:opacity-50";
const saveClass = "inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const listing = z.object({ contracts: z.array(advertisingContractSchema) });
const mutation = z.object({ contract: advertisingContractSchema });
const localDate = (date: string) => new Date(Date.parse(date) + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);
const utcDate = (value: FormDataEntryValue | null) => {
  const date = Date.parse(`${String(value)}:00+07:00`);
  return Number.isFinite(date) ? new Date(date).toISOString() : "";
};
type Mutate = (path: string, method: string, data: AdvertisingInput | { expectedUpdatedAt: string; reason?: string } | FormData) => Promise<void>;

function AdvertisingEditor({ contract, pending, mutate, close }: { contract: AdvertisingContract | null; pending: boolean; mutate: Mutate; close: () => void }) {
  const { t, language } = useLanguage();
  const [invalid, setInvalid] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [reason, setReason] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const cents = Math.round(Number(data.get("amount")) * 100);
    const parsed = advertisingInputSchema.safeParse({
      advertiser: data.get("advertiser"), contactName: data.get("contactName"), contactEmail: data.get("contactEmail"), contactPhone: data.get("contactPhone"),
      title: data.get("title"), description: data.get("description"), targetUrl: data.get("targetUrl"),
      placements: data.getAll("placements"), status: data.get("status"), startsAt: utcDate(data.get("startsAt")), endsAt: utcDate(data.get("endsAt")),
      amountCents: cents, priority: Number(data.get("priority")), notes: data.get("notes") || null, terms: data.get("terms") || null,
    });
    setInvalid(!parsed.success);
    if (parsed.success) void mutate(contract ? `/api/admin/advertising/${contract.id}` : "/api/admin/advertising", contract ? "PATCH" : "POST", contract ? { ...parsed.data, expectedUpdatedAt: contract.updatedAt } : parsed.data);
  }
  async function upload(file?: File) {
    if (!file || !contract) return;
    if (!file.size || file.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setImageError(true); return; }
    setImageError(false);
    const form = new FormData();
    form.set("file", file);
    await mutate(`/api/admin/advertising/${contract.id}/image?expectedUpdatedAt=${encodeURIComponent(contract.updatedAt)}`, "PUT", form);
  }
  const textFields: { name: string; label: TranslationKey; max: number; type?: string; required?: boolean; value: string }[] = [
    { name: "advertiser", label: "ads.advertiser", max: 200, required: true, value: contract?.advertiser ?? "" },
    { name: "contactName", label: "ads.contactName", max: 200, required: true, value: contract?.contactName ?? "" },
    { name: "contactEmail", label: "ads.email", max: 254, type: "email", value: contract?.contactEmail ?? "" },
    { name: "contactPhone", label: "ads.phone", max: 50, type: "tel", value: contract?.contactPhone ?? "" },
    { name: "title", label: "ads.headline", max: 160, required: true, value: contract?.title ?? "" },
    { name: "targetUrl", label: "ads.link", max: 2000, type: "url", required: true, value: contract?.targetUrl ?? "" },
  ];
  return <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t(contract ? "ads.edit" : "ads.new")}</h2><button type="button" className={buttonClass} disabled={pending} onClick={close}>{t("blog.close")}</button></header>
    <p className="mt-4 text-sm leading-6 text-slate-600">{t("ads.notice")}</p><p className="mt-2 text-sm leading-6 text-slate-600">{t("ads.internal")}</p>
    {invalid && <p className="mt-4 text-red-700" role="alert">{t("ads.failure")}</p>}
    <form onSubmit={submit} className="mt-5"><fieldset disabled={pending} className="grid min-w-0 gap-4 sm:grid-cols-2">
      {textFields.map((field) => <label key={field.name} className="grid min-w-0 gap-2 text-sm">{t(field.label)}<input name={field.name} type={field.type ?? "text"} required={field.required} maxLength={field.max} defaultValue={field.value} className={fieldClass} /></label>)}
      <label className="grid min-w-0 gap-2 text-sm sm:col-span-2">{t("ads.description")}<textarea name="description" rows={3} required maxLength={500} defaultValue={contract?.description ?? ""} className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("ads.start")}<input type="datetime-local" name="startsAt" required defaultValue={contract ? localDate(contract.startsAt) : ""} className={fieldClass} /><span className="text-xs text-slate-500">{t("driver.localTime")}</span></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("ads.end")}<input type="datetime-local" name="endsAt" required defaultValue={contract ? localDate(contract.endsAt) : ""} className={fieldClass} /><span className="text-xs text-slate-500">{t("driver.localTime")}</span></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("ads.amount")}<input type="number" name="amount" required min={0} max={1000000} step="0.01" defaultValue={contract ? (contract.amountCents / 100).toFixed(2) : "0.00"} className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("ads.priority")}<input type="number" name="priority" required min={0} max={999} step={1} defaultValue={contract?.priority ?? 0} className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm">{t("records.status")}<select name="status" defaultValue={contract?.status ?? "DRAFT"} className={fieldClass}>{advertisingStatuses.map((status) => <option key={status} value={status}>{t(`ads.${status}`)}</option>)}</select></label>
      <fieldset className="min-w-0 rounded-xl border p-3"><legend className="px-1 text-sm">{t("ads.placements")}</legend>{advertisingPlacements.map((placement) => <label key={placement} className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" name="placements" value={placement} defaultChecked={contract?.placements.includes(placement) ?? false} />{t(`ads.${placement}`)}</label>)}</fieldset>
      <label className="grid min-w-0 gap-2 text-sm sm:col-span-2">{t("ads.terms")}<textarea name="terms" maxLength={8000} rows={4} defaultValue={contract?.terms ?? ""} className={fieldClass} /></label>
      <label className="grid min-w-0 gap-2 text-sm sm:col-span-2">{t("finance.notes")}<textarea name="notes" maxLength={4000} rows={3} defaultValue={contract?.notes ?? ""} className={fieldClass} /></label>
      <button type="submit" className={`${saveClass} sm:col-span-2`}>{t(pending ? "admin.saving" : "courses.save")}</button>
    </fieldset></form>
    {contract ? <div className="mt-6 grid min-w-0 gap-4">
      <a href={`/api/admin/advertising/${contract.id}/pdf?language=${language}`} className={buttonClass}>{t("ads.pdf")}</a>
      {contract.image && <div className="max-w-xl"><AdvertisingImage key={`${contract.id}-${contract.image.updatedAt}`} id={contract.id} version={contract.image.updatedAt} title={contract.title} preview /></div>}
      {imageError && <p role="alert" className="text-red-700">{t("ads.imageFailure")}</p>}
      <label className="grid min-w-0 gap-2 text-sm">{t("ads.image")}<input type="file" accept="image/jpeg,image/png,image/webp" disabled={pending} className={fieldClass} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ""; }} /></label>
      {contract.image && <button type="button" disabled={pending} className={buttonClass} onClick={() => void mutate(`/api/admin/advertising/${contract.id}/image`, "DELETE", { expectedUpdatedAt: contract.updatedAt })}>{t("ads.removeImage")}</button>}
      <label className="grid min-w-0 gap-2 text-sm">{t("ads.deleteReason")}<input maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={fieldClass} /></label>
      <button type="button" className={`${buttonClass} border-red-200 text-red-800`} disabled={pending || !reason.trim()} onClick={() => { if (window.confirm(t("ads.confirmDelete"))) void mutate(`/api/admin/advertising/${contract.id}`, "DELETE", { expectedUpdatedAt: contract.updatedAt, reason: reason.trim() }); }}>{t("ads.archive")}</button>
    </div> : <p className="mt-4 text-sm text-slate-600">{t("ads.saveFirst")}</p>}
  </section>;
}

export function AdvertisingPanel() {
  const { t, language } = useLanguage();
  const [contracts, setContracts] = useState<AdvertisingContract[]>([]);
  const [selected, setSelected] = useState<AdvertisingContract | null | undefined>();
  const [editorVersion, setEditorVersion] = useState(0);
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [status, setStatus] = useState("");
  const [placement, setPlacement] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const lock = useRef(false);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);
  const refresh = useCallback((signal?: AbortSignal) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    const timeout = window.setTimeout(() => controller.abort(new DOMException("Advertising request timed out", "TimeoutError")), 60000);
    return fetch("/api/admin/advertising", { cache: "no-store", signal: controller.signal }).then(async (response) => {
      if (!response.ok) throw new Error(`Advertising HTTP ${response.status}`);
      return listing.parse(await response.json()).contracts;
    }).then(setContracts).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === "AbortError") return;
      setError("ads.error");
    }).finally(() => { window.clearTimeout(timeout); signal?.removeEventListener("abort", abort); if (!signal?.aborted) setLoading(false); });
  }, []);
  useEffect(() => { const controller = new AbortController(); void refresh(controller.signal); return () => controller.abort(); }, [refresh]);
  const sorted = useListSort(contracts.filter((contract) => (!status || contract.status === status) && (!placement || contract.placements.some((item) => item === placement))), [
    { key: "created", label: t("sorting.created"), value: (item) => sortDate(item.createdAt) },
    { key: "start", label: t("ads.start"), value: (item) => sortDate(item.startsAt) },
    { key: "end", label: t("ads.end"), value: (item) => sortDate(item.endsAt) },
    { key: "advertiser", label: t("ads.advertiser"), value: (item) => item.advertiser },
    { key: "status", label: t("records.status"), value: (item) => t(`ads.${item.status}`) },
    { key: "amount", label: t("ads.amount"), value: (item) => item.amountCents },
    { key: "priority", label: t("ads.priority"), value: (item) => item.priority },
  ], { key: "created", direction: "desc" });
  const mutate: Mutate = async (path, method, data) => {
    if (lock.current) return;
    lock.current = true;
    setPending(true); setError(null); setSaved(false);
    try {
      if (data instanceof FormData) {
        const file = data.get("file");
        if (!(file instanceof File)) throw new Error("INVALID_IMAGE");
        data.set("file", await prepareBlogImage(file));
      }
      const response = await fetch(path, { method, signal: AbortSignal.timeout(60000), headers: data instanceof FormData ? undefined : { "Content-Type": "application/json" }, body: data instanceof FormData ? data : JSON.stringify(data) });
      if (!response.ok) { setError(response.status === 409 ? "ads.conflict" : response.status === 403 ? "admin.sessionExpired" : [413, 415].includes(response.status) ? "ads.imageFailure" : "ads.failure"); return; }
      const updated = mutation.parse(await response.json()).contract;
      const deleting = method === "DELETE" && !path.includes("/image");
      setContracts((current) => deleting ? current.filter((contract) => contract.id !== updated.id) : [updated, ...current.filter((contract) => contract.id !== updated.id)]);
      setSelected(deleting ? undefined : updated);
      if (!path.includes("/image")) setEditorVersion((current) => current + 1);
      setSaved(true);
    } catch { setError(data instanceof FormData ? "ads.imageFailure" : "ads.failure"); }
    finally { lock.current = false; setPending(false); }
  };
  const date = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "Asia/Phnom_Penh" }).format(new Date(value));
  return <div className="grid min-w-0 gap-5">
    <header className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-bold">{t("ads.admin")}</h2><div className="flex flex-wrap gap-3"><button type="button" className={buttonClass} disabled={loading || pending} onClick={() => { setLoading(true); setError(null); void refresh(); }}>{t("admin.retry")}</button><button type="button" className={saveClass} disabled={loading || pending} onClick={() => { setSelected(null); setEditorVersion((current) => current + 1); setSaved(false); }}>{t("ads.new")}</button></div></header>
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">{t(error)}</p>}
    {saved && <p role="status" className="rounded-xl bg-green-50 p-4 text-green-800">{t("ads.saved")}</p>}
    {loading && <p role="status">{t("ads.loading")}</p>}
    {selected !== undefined && <AdvertisingEditor key={`${selected?.id ?? "new"}-${editorVersion}`} contract={selected} pending={pending} mutate={mutate} close={() => setSelected(undefined)} />}
    <section className="min-w-0 rounded-2xl border bg-white p-4 sm:p-6">
      <div className="grid min-w-0 gap-3 sm:grid-cols-2"><label className="grid min-w-0 gap-2 text-sm">{t("records.status")}<select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">{t("ads.all")}</option>{advertisingStatuses.map((item) => <option key={item} value={item}>{t(`ads.${item}`)}</option>)}</select></label><label className="grid min-w-0 gap-2 text-sm">{t("ads.placements")}<select className={fieldClass} value={placement} onChange={(event) => setPlacement(event.target.value)}><option value="">{t("ads.all")}</option>{advertisingPlacements.map((item) => <option key={item} value={item}>{t(`ads.${item}`)}</option>)}</select></label></div>
      {sorted.controls}
      {!loading && !sorted.items.length && <p className="py-4 text-sm text-slate-600">{t("ads.empty")}</p>}
      <ul className="grid min-w-0 gap-4">{sorted.items.map((contract) => {
        const display = contract.status !== "ACTIVE" ? t(`ads.${contract.status}`) : now < Date.parse(contract.startsAt) ? t("ads.scheduled") : now >= Date.parse(contract.endsAt) ? t("ads.expired") : t("ads.current");
        return <li key={contract.id} className="min-w-0 rounded-xl border border-slate-200 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-bold">{contract.advertiser} · {contract.title}</h3><p className="mt-1 break-words text-xs text-slate-500">{contract.reference}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-900">{display}</span></div>
          <p className="mt-3 text-sm text-slate-600">{date(contract.startsAt)} — {date(contract.endsAt)} · USD {(contract.amountCents / 100).toFixed(2)}</p>
          <p className="mt-2 text-sm text-slate-600">{contract.placements.map((item) => t(`ads.${item}`)).join(" · ")}</p>
          <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={buttonClass} disabled={pending} onClick={() => { setSelected(contract); setEditorVersion((current) => current + 1); setSaved(false); }}>{t("ads.edit")}</button><a href={`/api/admin/advertising/${contract.id}/pdf?language=${language}`} className={buttonClass}>{t("ads.pdf")}</a></div>
        </li>;
      })}</ul>
    </section>
  </div>;
}
