"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Download, ExternalLink, FileSignature, Trash2, Upload, X } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";

type Translate = ReturnType<typeof useLanguage>["t"];
type Key = Parameters<Translate>[0];
type Contract = { id: string; reference: string; status: "DRAFT" | "ACTIVE" | "TERMINATED"; position: string; workplace: string; startsAt: string; probationMonths: number; hoursPerWeek: number; monthlySalaryCents: number; currency: string; annualLeaveDays: number; additionalTerms: string | null; activatedAt: string | null; terminatedAt: string | null };
type Account = {
  id: string; name: string; email: string; phone: string | null; role: "ADMIN" | "DRIVER" | "CUSTOMER"; status: "ACTIVE" | "SUSPENDED" | "INVITED"; createdAt: string; _count: { bookings: number };
  customer: { address: string | null; nationality: string | null; preferredLanguage: string | null; company: string | null; adminNotes: string | null } | null;
  driver: {
    id: string; isAvailable: boolean; licenseNo: string | null; licenseCategory: string | null; licenseExpiresAt: string | null; dateOfBirth: string | null; nationality: string | null; idDocumentNo: string | null; address: string | null; emergencyContactName: string | null; emergencyContactPhone: string | null; adminNotes: string | null;
    licenseImages: Array<{ side: "FRONT" | "BACK"; sizeBytes: number; uploadedAt: string }>; employmentContracts: Contract[]; _count: { bookings: number };
  } | null;
  contractReadiness: string[] | null;
};
type Feedback = { kind: "ok" | "error"; key: Key; missing?: string[] } | null;

const inputClass = "w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]";
const buttonClass = "inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-50";
const primaryButton = `${buttonClass} bg-[var(--color-primary)] text-white`;
const secondaryButton = `${buttonClass} border border-slate-300 bg-white text-slate-800`;
const dangerButton = `${buttonClass} border border-red-200 bg-white text-[var(--color-error)]`;
const day = (value: string | null) => value?.slice(0, 10) ?? "";
const text = (value: string | null | undefined) => value ?? "";

async function call(path: string, init?: RequestInit) {
  const response = await fetch(path, { ...init, cache: "no-store" });
  const body = await response.json().catch(() => null) as Record<string, unknown> | null;
  return { ok: response.ok, status: response.status, body };
}
const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

function Field({ label, value, onChange, type = "text", multiline = false, required = false, clearLabel, ...rest }: { label: string; value: string; onChange: (value: string) => void; type?: string; multiline?: boolean; required?: boolean; clearLabel: string; min?: number; max?: number; step?: string; maxLength?: number; inputMode?: "tel" | "decimal" | "numeric" }) {
  return <label className={`grid gap-1 text-sm font-medium text-slate-700 ${multiline ? "sm:col-span-2" : ""}`}>
    {label}
    <span className="flex items-start gap-1.5">
      {multiline
        ? <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={3} maxLength={rest.maxLength} className={inputClass} />
        : <input value={value} onChange={(event) => onChange(event.target.value)} type={type} required={required} className={inputClass} {...rest} />}
      {!required && value && <button type="button" onClick={() => onChange("")} aria-label={`${clearLabel} · ${label}`} title={clearLabel} className="mt-1.5 rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-[var(--color-error)]"><X size={15} aria-hidden="true" /></button>}
    </span>
  </label>;
}

function Panel({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return <section className="rounded-3xl border border-slate-200 bg-white p-5"><h3 className="text-base font-bold">{title}</h3>{help && <p className="mt-1 text-sm text-slate-500">{help}</p>}<div className="mt-4">{children}</div></section>;
}

function Message({ feedback, t }: { feedback: Feedback; t: Translate }) {
  if (!feedback) return null;
  return <div role={feedback.kind === "ok" ? "status" : "alert"} className={`mt-3 text-sm font-semibold ${feedback.kind === "ok" ? "text-emerald-700" : "text-[var(--color-error)]"}`}>
    {t(feedback.key)}
    {feedback.missing?.length ? <ul className="mt-1 list-disc pl-5 font-normal">{feedback.missing.map((item) => <li key={item}>{t(`profile.missing.${item}` as Key)}</li>)}</ul> : null}
  </div>;
}

function useSave(onSaved: (account: Account) => void, accountId: string) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  async function save(body: unknown) {
    setPending(true);
    setFeedback(null);
    try {
      const result = await call(`/api/admin/accounts/${accountId}`, json("PATCH", body));
      if (!result.ok || !result.body?.account) throw new Error("save");
      onSaved(result.body.account as Account);
      setFeedback({ kind: "ok", key: "profile.saved" });
    } catch {
      setFeedback({ kind: "error", key: "profile.saveError" });
    } finally {
      setPending(false);
    }
  }
  return { pending, feedback, save };
}

function IdentityForm({ account, onSaved, editable }: { account: Account; onSaved: (account: Account) => void; editable: boolean }) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: account.name, email: account.email, phone: text(account.phone), status: account.status === "SUSPENDED" ? "SUSPENDED" : "ACTIVE" });
  const { pending, feedback, save } = useSave(onSaved, account.id);
  const submit = (event: FormEvent) => { event.preventDefault(); void save(form); };
  return <Panel title={t("profile.identity")} help={account.role !== "CUSTOMER" ? t("profile.emailHelp") : undefined}>
    <form onSubmit={submit}><fieldset disabled={!editable || pending} className="grid gap-3 sm:grid-cols-2">
      <Field label={t("profile.name")} value={form.name} onChange={(name) => setForm({ ...form, name })} required maxLength={200} clearLabel={t("profile.clear")} />
      <Field label={t("profile.email")} type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} required maxLength={254} clearLabel={t("profile.clear")} />
      <Field label={t("profile.phone")} type="tel" inputMode="tel" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} maxLength={30} clearLabel={t("profile.clear")} />
      <label className="grid gap-1 text-sm font-medium text-slate-700">{t("profile.status")}
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as "ACTIVE" | "SUSPENDED" })} className={inputClass}>
          <option value="ACTIVE">{t("profile.active")}</option><option value="SUSPENDED">{t("profile.suspended")}</option>
        </select>
      </label>
      <p className="text-xs text-slate-500 sm:col-span-2">{t("profile.statusHelp")}</p>
      <div className="sm:col-span-2"><button type="submit" className={primaryButton}>{pending ? t("profile.saving") : t("profile.save")}</button></div>
    </fieldset></form>
    <Message feedback={feedback} t={t} />
  </Panel>;
}

function CustomerForm({ account, onSaved }: { account: Account; onSaved: (account: Account) => void }) {
  const { t } = useLanguage();
  const customer = account.customer;
  const [form, setForm] = useState({ address: text(customer?.address), nationality: text(customer?.nationality), preferredLanguage: text(customer?.preferredLanguage), company: text(customer?.company), adminNotes: text(customer?.adminNotes) });
  const { pending, feedback, save } = useSave(onSaved, account.id);
  const field = (key: keyof typeof form, label: Key, max: number, multiline = false) => <Field label={t(label)} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} maxLength={max} multiline={multiline} clearLabel={t("profile.clear")} />;
  return <Panel title={t("profile.customerDetails")} help={t("profile.customerHelp")}>
    <form onSubmit={(event) => { event.preventDefault(); void save({ customer: form }); }}><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      {field("nationality", "profile.nationality", 100)}{field("preferredLanguage", "profile.preferredLanguage", 50)}
      {field("company", "profile.company", 200)}{field("address", "profile.address", 500)}
      {field("adminNotes", "profile.adminNotes", 4000, true)}
      <div className="sm:col-span-2"><button type="submit" className={primaryButton}>{pending ? t("profile.saving") : t("profile.save")}</button></div>
    </fieldset></form>
    <Message feedback={feedback} t={t} />
  </Panel>;
}

function DriverForm({ account, onSaved }: { account: Account; onSaved: (account: Account) => void }) {
  const { t } = useLanguage();
  const driver = account.driver!;
  const [form, setForm] = useState({
    dateOfBirth: day(driver.dateOfBirth), nationality: text(driver.nationality), idDocumentNo: text(driver.idDocumentNo), address: text(driver.address),
    emergencyContactName: text(driver.emergencyContactName), emergencyContactPhone: text(driver.emergencyContactPhone),
    licenseNo: text(driver.licenseNo), licenseCategory: text(driver.licenseCategory), licenseExpiresAt: day(driver.licenseExpiresAt), adminNotes: text(driver.adminNotes),
  });
  const [isAvailable, setAvailable] = useState(driver.isAvailable);
  const { pending, feedback, save } = useSave(onSaved, account.id);
  const field = (key: keyof typeof form, label: Key, max: number, type = "text", multiline = false) => <Field label={t(label)} type={type} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} maxLength={max} multiline={multiline} clearLabel={t("profile.clear")} />;
  return <Panel title={t("profile.driverDetails")} help={t("profile.driverHelp")}>
    <form onSubmit={(event) => { event.preventDefault(); void save({ driver: { ...form, isAvailable } }); }}><fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      {field("dateOfBirth", "profile.dateOfBirth", 10, "date")}{field("nationality", "profile.nationality", 100)}
      {field("idDocumentNo", "profile.idDocumentNo", 100)}{field("address", "profile.address", 500)}
      {field("emergencyContactName", "profile.emergencyName", 200)}{field("emergencyContactPhone", "profile.emergencyPhone", 30, "tel")}
      {field("licenseNo", "profile.licenseNo", 100)}{field("licenseCategory", "profile.licenseCategory", 50)}
      {field("licenseExpiresAt", "profile.licenseExpiresAt", 10, "date")}
      <label className="flex items-center gap-2 self-end pb-2.5 text-sm font-medium text-slate-700"><input type="checkbox" checked={isAvailable} onChange={(event) => setAvailable(event.target.checked)} className="h-4 w-4" />{t("profile.available")}</label>
      {field("adminNotes", "profile.adminNotes", 4000, "text", true)}
      <div className="sm:col-span-2"><button type="submit" className={primaryButton}>{pending ? t("profile.saving") : t("profile.save")}</button></div>
    </fieldset></form>
    <Message feedback={feedback} t={t} />
  </Panel>;
}

function LicensePhotos({ account, reload }: { account: Account; reload: () => Promise<void> }) {
  const { t, language } = useLanguage();
  const driver = account.driver!;
  const [pending, setPending] = useState<"FRONT" | "BACK" | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  async function upload(side: "FRONT" | "BACK", file: File | undefined) {
    if (!file) return;
    setPending(side);
    setFeedback(null);
    const body = new FormData();
    body.append("file", file);
    const result = await call(`/api/drivers/${driver.id}/license/${side}`, { method: "PUT", body }).catch(() => ({ ok: false }));
    if (result.ok) { await reload(); setFeedback({ kind: "ok", key: "profile.saved" }); } else setFeedback({ kind: "error", key: "profile.uploadError" });
    setPending(null);
  }
  async function remove(side: "FRONT" | "BACK") {
    if (!window.confirm(t("profile.deletePhotoConfirm"))) return;
    setPending(side);
    setFeedback(null);
    const result = await call(`/api/drivers/${driver.id}/license/${side}`, { method: "DELETE" }).catch(() => ({ ok: false }));
    if (result.ok) { await reload(); setFeedback({ kind: "ok", key: "profile.saved" }); } else setFeedback({ kind: "error", key: "profile.saveError" });
    setPending(null);
  }
  return <Panel title={t("profile.licensePhotos")} help={t("profile.licensePhotosHelp")}>
    <div className="grid gap-4 sm:grid-cols-2">{(["FRONT", "BACK"] as const).map((side) => {
      const image = driver.licenseImages.find((item) => item.side === side);
      const src = image ? `/api/drivers/${driver.id}/license/${side}?v=${encodeURIComponent(image.uploadedAt)}` : null;
      return <div key={side} className="rounded-2xl border border-slate-200 p-3">
        <div className="flex items-center justify-between text-sm font-semibold"><span>{t(`profile.${side}`)}</span>{image && <small className="font-normal text-slate-500">{new Intl.DateTimeFormat(language, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Phnom_Penh" }).format(new Date(image.uploadedAt))} · {Math.ceil(image.sizeBytes / 1024)} KB</small>}</div>
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated API image, not optimisable by next/image */}
        {src ? <img src={src} alt={`${t("profile.licensePhotos")} · ${t(`profile.${side}`)}`} className="mt-2 h-36 w-full rounded-xl bg-slate-100 object-contain" /> : <p className="mt-2 grid h-36 place-items-center rounded-xl bg-slate-50 text-sm text-slate-400">{t("profile.missingPhoto")}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {src && <a href={src} target="_blank" rel="noopener noreferrer" className={secondaryButton}><ExternalLink size={14} aria-hidden="true" />{t("profile.view")}</a>}
          <label className={`${secondaryButton} cursor-pointer ${pending ? "pointer-events-none opacity-50" : ""}`}><Upload size={14} aria-hidden="true" />{t(image ? "profile.replace" : "profile.upload")}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" aria-label={`${t(image ? "profile.replace" : "profile.upload")} · ${t(`profile.${side}`)}`} disabled={Boolean(pending)} onChange={(event) => { void upload(side, event.target.files?.[0]); event.target.value = ""; }} />
          </label>
          {image && <button type="button" disabled={Boolean(pending)} onClick={() => void remove(side)} className={dangerButton}><Trash2 size={14} aria-hidden="true" />{t("profile.delete")}</button>}
        </div>
      </div>;
    })}</div>
    <Message feedback={feedback} t={t} />
  </Panel>;
}

type ContractForm = { position: string; workplace: string; startsAt: string; probationMonths: string; hoursPerWeek: string; salary: string; annualLeaveDays: string; additionalTerms: string };
const contractPayload = (form: ContractForm) => ({
  position: form.position, workplace: form.workplace, startsAt: form.startsAt, probationMonths: Number(form.probationMonths), hoursPerWeek: Number(form.hoursPerWeek),
  monthlySalaryCents: Math.round(Number(form.salary) * 100), annualLeaveDays: Number(form.annualLeaveDays), additionalTerms: form.additionalTerms,
});

function ContractEditor({ initial, submitLabel, onSubmit, onCancel }: { initial: ContractForm; submitLabel: Key; onSubmit: (form: ContractForm) => Promise<void>; onCancel?: () => void }) {
  const { t } = useLanguage();
  const [form, setForm] = useState(initial);
  const [pending, setPending] = useState(false);
  const field = (key: keyof ContractForm, label: Key, props: Partial<Parameters<typeof Field>[0]> = {}) => <Field label={t(label)} value={form[key]} onChange={(value) => setForm({ ...form, [key]: value })} clearLabel={t("profile.clear")} {...props} />;
  return <form onSubmit={async (event) => { event.preventDefault(); setPending(true); await onSubmit(form); setPending(false); }} className="mt-3 rounded-2xl bg-slate-50 p-4">
    <fieldset disabled={pending} className="grid gap-3 sm:grid-cols-2">
      {field("position", "profile.position", { required: true, maxLength: 120 })}{field("workplace", "profile.workplace", { required: true, maxLength: 200 })}
      {field("startsAt", "profile.startsAt", { required: true, type: "date" })}{field("salary", "profile.salary", { required: true, type: "number", min: 0.01, step: "0.01", inputMode: "decimal" })}
      {field("probationMonths", "profile.probationMonths", { required: true, type: "number", min: 0, max: 3 })}{field("hoursPerWeek", "profile.hoursPerWeek", { required: true, type: "number", min: 1, max: 48 })}
      {field("annualLeaveDays", "profile.annualLeaveDays", { required: true, type: "number", min: 18, max: 60 })}
      {field("additionalTerms", "profile.additionalTerms", { multiline: true, maxLength: 4000 })}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button type="submit" className={primaryButton}>{pending ? t("profile.saving") : t(submitLabel)}</button>{onCancel && <button type="button" onClick={onCancel} className={secondaryButton}>{t("profile.cancel")}</button>}</div>
    </fieldset>
  </form>;
}

function Contracts({ account, reload }: { account: Account; reload: () => Promise<void> }) {
  const { t, language } = useLanguage();
  const driver = account.driver!;
  const [today] = useState(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Phnom_Penh" }).format(new Date()));
  const [mode, setMode] = useState<{ kind: "create" } | { kind: "edit" | "terminate"; id: string } | null>(null);
  const [terminatedAt, setTerminatedAt] = useState(today);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [busy, setBusy] = useState(false);
  const formatDate = (value: string) => new Intl.DateTimeFormat(language, { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value));
  const money = (contract: Contract) => new Intl.NumberFormat(language, { style: "currency", currency: contract.currency }).format(contract.monthlySalaryCents / 100);
  async function run(request: Promise<{ ok: boolean; body: Record<string, unknown> | null }>) {
    setBusy(true);
    setFeedback(null);
    const result = await request.catch(() => ({ ok: false, body: null }));
    if (result.ok) {
      setMode(null);
      await reload();
      setFeedback({ kind: "ok", key: "profile.saved" });
    } else {
      const missing = Array.isArray(result.body?.missing) ? result.body.missing as string[] : undefined;
      setFeedback({ kind: "error", key: missing ? "profile.missingTitle" : "profile.contractError", missing });
    }
    setBusy(false);
  }
  const blank: ContractForm = { position: "Driver", workplace: "Siem Reap", startsAt: today, probationMonths: "0", hoursPerWeek: "48", salary: "", annualLeaveDays: "18", additionalTerms: "" };
  const statusClass = { DRAFT: "bg-amber-50 text-amber-800", ACTIVE: "bg-emerald-50 text-emerald-800", TERMINATED: "bg-slate-100 text-slate-600" } as const;
  const readiness = account.contractReadiness ?? [];

  return <Panel title={t("profile.contracts")} help={t("profile.contractsHelp")}>
    <div className={`rounded-2xl p-3 text-sm ${readiness.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
      {readiness.length ? <><strong>{t("profile.missingTitle")}</strong><ul className="mt-1 list-disc pl-5">{readiness.map((item) => <li key={item}>{t(`profile.missing.${item}` as Key)}</li>)}</ul></> : t("profile.readyForContract")}
    </div>
    {driver.employmentContracts.length ? <ul className="mt-4 grid gap-3">{driver.employmentContracts.map((contract) => <li key={contract.id} className="rounded-2xl border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><strong className="font-mono text-sm">{contract.reference}</strong> <span className={`ml-2 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[contract.status]}`}>{t(`profile.contract${contract.status}`)}</span>
          <p className="mt-1 text-sm text-slate-600">{contract.position} · {contract.workplace} · {formatDate(contract.startsAt)}{contract.terminatedAt ? ` → ${formatDate(contract.terminatedAt)}` : ""} · {money(contract)} · {contract.hoursPerWeek} h</p></div>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/admin/contracts/${contract.id}/pdf`} className={secondaryButton}><Download size={14} aria-hidden="true" />{t("profile.downloadPdf")}</a>
          {contract.status === "DRAFT" && <>
            <button type="button" disabled={busy} onClick={() => setMode({ kind: "edit", id: contract.id })} className={secondaryButton}>{t("profile.editContract")}</button>
            <button type="button" disabled={busy} onClick={() => void run(call(`/api/admin/contracts/${contract.id}`, json("PATCH", { action: "activate" })))} className={primaryButton}><FileSignature size={14} aria-hidden="true" />{t("profile.activate")}</button>
            <button type="button" disabled={busy} onClick={() => { if (window.confirm(t("profile.deleteDraftConfirm"))) void run(call(`/api/admin/contracts/${contract.id}`, { method: "DELETE" })); }} className={dangerButton}><Trash2 size={14} aria-hidden="true" />{t("profile.delete")}</button>
          </>}
          {contract.status === "ACTIVE" && <button type="button" disabled={busy} onClick={() => setMode({ kind: "terminate", id: contract.id })} className={dangerButton}>{t("profile.terminate")}</button>}
        </div>
      </div>
      {mode?.kind === "edit" && mode.id === contract.id && <ContractEditor submitLabel="profile.save" onCancel={() => setMode(null)}
        initial={{ position: contract.position, workplace: contract.workplace, startsAt: day(contract.startsAt), probationMonths: String(contract.probationMonths), hoursPerWeek: String(contract.hoursPerWeek), salary: (contract.monthlySalaryCents / 100).toFixed(2), annualLeaveDays: String(contract.annualLeaveDays), additionalTerms: text(contract.additionalTerms) }}
        onSubmit={(form) => run(call(`/api/admin/contracts/${contract.id}`, json("PATCH", { action: "update", data: contractPayload(form) })))} />}
      {mode?.kind === "terminate" && mode.id === contract.id && <form onSubmit={(event) => { event.preventDefault(); void run(call(`/api/admin/contracts/${contract.id}`, json("PATCH", { action: "terminate", terminatedAt }))); }} className="mt-3 flex flex-wrap items-end gap-2 rounded-2xl bg-slate-50 p-4">
        <label className="grid gap-1 text-sm font-medium text-slate-700">{t("profile.terminatedAt")}<input type="date" required min={day(contract.startsAt)} value={terminatedAt} onChange={(event) => setTerminatedAt(event.target.value)} className={inputClass} /></label>
        <button type="submit" disabled={busy} className={`${buttonClass} bg-[var(--color-error)] text-white`}>{t("profile.terminate")}</button>
        <button type="button" onClick={() => setMode(null)} className={secondaryButton}>{t("profile.cancel")}</button>
      </form>}
    </li>)}</ul> : <p className="mt-4 text-sm text-slate-500">{t("profile.noContracts")}</p>}
    {mode?.kind === "create"
      ? <ContractEditor initial={blank} submitLabel="profile.createContract" onCancel={() => setMode(null)} onSubmit={(form) => run(call(`/api/admin/drivers/${driver.id}/contracts`, json("POST", contractPayload(form))))} />
      : <button type="button" disabled={busy} onClick={() => setMode({ kind: "create" })} className={`${primaryButton} mt-4`}><FileSignature size={14} aria-hidden="true" />{t("profile.newContract")}</button>}
    <Message feedback={feedback} t={t} />
  </Panel>;
}

export function AccountProfile({ userId, currentUserId, onChanged, onClose }: { userId: string; currentUserId?: string; onChanged: () => void; onClose: () => void }) {
  const { t } = useLanguage();
  const [state, setState] = useState<{ account?: Account; failed?: boolean }>({});
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    call(`/api/admin/accounts/${userId}`).then(
      (result) => { if (active) setState(result.ok && result.body?.account ? { account: result.body.account as Account } : { failed: true }); },
      () => { if (active) setState({ failed: true }); },
    );
    return () => { active = false; };
  }, [userId, attempt]);
  if (state.account) return <AccountProfileEditor key={state.account.id} account={state.account} currentUserId={currentUserId} onChanged={onChanged} onClose={onClose} />;
  return <section className="mt-6 rounded-[28px] bg-slate-50 p-6 text-sm" aria-live="polite">
    {state.failed ? <p role="alert" className="font-semibold text-[var(--color-error)]">{t("profile.loadError")} <button type="button" onClick={() => { setState({}); setAttempt((value) => value + 1); }} className="underline">{t("profile.retry")}</button></p> : <p className="text-slate-500">{t("profile.loading")}</p>}
  </section>;
}

function AccountProfileEditor({ account: initial, currentUserId, onChanged, onClose }: { account: Account; currentUserId?: string; onChanged: () => void; onClose: () => void }) {
  const { t, language } = useLanguage();
  const [account, setAccount] = useState(initial);
  const editable = account.id !== currentUserId;
  function saved(next: Account) {
    setAccount(next);
    onChanged();
  }
  async function reload() {
    const result = await call(`/api/admin/accounts/${account.id}`);
    if (result.ok && result.body?.account) {
      setAccount(result.body.account as Account);
    }
    onChanged();
  }
  return <section aria-labelledby="account-profile-title" className="mt-6 rounded-[28px] bg-slate-50 p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="account-profile-title" className="text-xl font-bold">{t("profile.title")} · {account.name}</h2>
        <p className="text-sm text-slate-500">{account.email} · {t("profile.createdAt")} {new Intl.DateTimeFormat(language, { dateStyle: "medium" }).format(new Date(account.createdAt))} · {t("profile.bookings")}: {account.driver?._count.bookings ?? account._count.bookings}</p></div>
      <button type="button" onClick={onClose} className={secondaryButton}><X size={14} aria-hidden="true" />{t("profile.close")}</button>
    </div>
    {!editable && <p className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm text-amber-900">{t("profile.self")}</p>}
    <div className="mt-4 grid gap-4">
      <IdentityForm account={account} onSaved={saved} editable={editable} />
      {account.role === "CUSTOMER" && <CustomerForm account={account} onSaved={saved} />}
      {account.role === "DRIVER" && account.driver && <>
        <DriverForm account={account} onSaved={saved} />
        <LicensePhotos account={account} reload={reload} />
        <Contracts account={account} reload={reload} />
      </>}
    </div>
  </section>;
}
