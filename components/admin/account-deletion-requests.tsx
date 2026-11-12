"use client";

import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { useLanguage } from "@/components/i18n/language-provider";

const schema = z.object({ requests: z.array(z.object({
  id: z.string(), createdAt: z.string(),
  user: z.object({ id: z.string(), name: z.string(), email: z.string(), role: z.string() }),
})) });
const copy = {
  fr: {
    title: "Demandes de suppression", help: "Traitez les demandes après vérification par email. Révoquez les sessions et notifications, supprimez les données non nécessaires et expliquez les seules exceptions légales et leur durée au demandeur. Clôturer ici enregistre le traitement ; cela ne supprime aucune donnée automatiquement.",
    reload: "Actualiser", empty: "Aucune demande en attente.", error: "Service indisponible ou accès refusé. Réessayez.",
    resolution: "Traitement effectué, données conservées, motif et durée (sans données sensibles)", complete: "Traitée : données supprimées", limited: "Traitée avec conservation légale limitée", save: "Enregistrer le traitement effectué", loading: "Chargement…",
  },
  en: {
    title: "Deletion requests", help: "Verify requests through the account email. Revoke sessions and notifications, erase unnecessary data, and explain any legal retention and its duration to the requester. Closing a request here records the work performed; it does not automatically erase data.",
    reload: "Refresh", empty: "No pending requests.", error: "Service unavailable or access denied. Retry.",
    resolution: "Work performed, retained data, reason and duration (no sensitive data)", complete: "Processed: data erased", limited: "Processed with limited legal retention", save: "Record completed processing", loading: "Loading…",
  },
  km: {
    title: "សំណើលុបទិន្នន័យ", help: "សូមផ្ទៀងផ្ទាត់តាមអ៊ីមែលគណនី។ ដកសម័យចូលប្រើ និងការជូនដំណឹង លុបទិន្នន័យមិនចាំបាច់ និងពន្យល់ការរក្សាទុកតាមច្បាប់ និងរយៈពេលដល់អ្នកស្នើ។ ការបិទសំណើនៅទីនេះកត់ត្រាការងារដែលបានធ្វើ មិនលុបទិន្នន័យដោយស្វ័យប្រវត្តិទេ។",
    reload: "ផ្ទុកឡើងវិញ", empty: "គ្មានសំណើកំពុងរង់ចាំ។", error: "សេវាមិនអាចប្រើបាន ឬគ្មានសិទ្ធិ។ សូមព្យាយាមម្ដងទៀត។",
    resolution: "ការងារដែលបានធ្វើ ទិន្នន័យរក្សា មូលហេតុ និងរយៈពេល (គ្មានទិន្នន័យរសើប)", complete: "បានដំណើរការ៖ បានលុបទិន្នន័យ", limited: "បានដំណើរការដោយរក្សាទុកតាមច្បាប់មានកំណត់", save: "កត់ត្រាការងារដែលបានធ្វើ", loading: "កំពុងផ្ទុក…",
  },
};
export function AccountDeletionRequests() {
  const { language } = useLanguage();
  const text = copy[language];
  const [items, setItems] = useState<z.infer<typeof schema>["requests"]>([]);
  const [revision, setRevision] = useState(0);
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/admin/account-deletions", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Deletion requests unavailable");
        const data = schema.parse(await response.json());
        setItems(data.requests); setLoaded(true); setError(false);
      } catch { if (!controller.signal.aborted) setError(true); }
    })();
    return () => controller.abort();
  }, [revision]);
  async function resolve(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    if (pending) return;
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true); setError(false);
    try {
      const response = await fetch("/api/admin/account-deletions", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, id }),
      });
      if (!response.ok) throw new Error("Deletion resolution failed");
      z.object({ ok: z.literal(true) }).parse(await response.json());
      setItems(current => current.filter(item => item.id !== id));
    } catch { setError(true); } finally { setPending(false); }
  }
  return <section className="space-y-4 rounded-2xl border bg-white p-5">
    <h2 className="text-xl font-bold">{text.title}</h2><p className="text-sm leading-6">{text.help}</p>
    <button type="button" className="rounded-xl border p-3" disabled={pending} onClick={() => setRevision(value => value + 1)}>{text.reload}</button>
    {error && <p role="alert" className="text-red-700">{text.error}</p>}
    {!loaded && !error && <p role="status">{text.loading}</p>}
    {loaded && !items.length && <p>{text.empty}</p>}
    {items.map(item => <form key={item.id} className="space-y-3 rounded-xl border p-4" onSubmit={event => void resolve(event, item.id)}>
      <p className="break-all">{item.user.name} · {item.user.email}</p><p className="text-sm">{item.id} · {item.createdAt}</p>
      <fieldset disabled={pending} className="grid gap-3">
        <label>{text.resolution}<textarea name="resolution" required minLength={20} maxLength={2000} className="mt-2 w-full rounded-lg border p-3" /></label>
        <select name="status" aria-label={text.title} className="rounded-lg border p-3"><option value="COMPLETED">{text.complete}</option><option value="LIMITED">{text.limited}</option></select>
        <button type="submit" className="rounded-xl bg-blue-900 p-3 text-white">{text.save}</button>
      </fieldset>
    </form>)}
  </section>;
}
