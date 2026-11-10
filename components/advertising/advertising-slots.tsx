"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { ExternalLink } from "lucide-react";
import { publicAdvertisingSchema, type AdvertisingPlacement, type PublicAdvertisement } from "@/lib/advertising-client";
import { useLanguage } from "@/components/i18n/language-provider";

const listing = z.object({ advertisements: z.array(publicAdvertisingSchema) });

export function AdvertisingImage({ id, version, title, preview = false }: { id: string; version: string; title: string; preview?: boolean }) {
  const [failed, setFailed] = useState(false);
  const { t } = useLanguage();
  if (failed) return <p role="status" className="p-3 text-sm text-slate-600">{t("ads.imageError")}</p>;
  // Database-backed, access-checked images must not be cached by the image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={`/api/advertising/${encodeURIComponent(id)}/image?version=${encodeURIComponent(version)}${preview ? "&preview=true" : ""}`} alt={title} width={600} height={300} loading="lazy" decoding="async" className="aspect-[2/1] w-full rounded-xl object-cover" onError={() => setFailed(true)} />;
}

export function AdvertisingSlots({ placement }: { placement: AdvertisingPlacement }) {
  const { t } = useLanguage();
  const [ads, setAds] = useState<PublicAdvertisement[]>([]);
  const [error, setError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let controller: AbortController | undefined;
    async function load() {
      controller?.abort();
      const requestController = new AbortController();
      controller = requestController;
      const timeout = window.setTimeout(() => requestController.abort(new DOMException("Advertising request timed out", "TimeoutError")), 20000);
      try {
        const response = await fetch(`/api/advertising?placement=${placement}`, { cache: "no-store", signal: requestController.signal });
        if (!response.ok) throw new Error(`Advertising HTTP ${response.status}`);
        const data = listing.parse(await response.json());
        if (active) { setAds(data.advertisements); setNow(Date.now()); setError(false); }
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
        if (active) { setAds([]); setError(true); }
      } finally { window.clearTimeout(timeout); }
    }
    void load();
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    const visible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => { active = false; controller?.abort(); window.clearInterval(interval); document.removeEventListener("visibilitychange", visible); };
  }, [placement, retry]);
  useEffect(() => {
    const end = Math.min(...ads.map((ad) => Date.parse(ad.endsAt)).filter((date) => date > now));
    if (!Number.isFinite(end)) return;
    const timeout = window.setTimeout(() => setNow(Date.now()), Math.min(2_147_483_647, Math.max(0, end - Date.now())));
    return () => window.clearTimeout(timeout);
  }, [ads, now]);
  const visible = ads.filter((ad) => Date.parse(ad.endsAt) > now);
  if (error) return <aside aria-label={t("ads.title")} className="mx-auto my-6 w-full max-w-7xl px-4"><p role="status" className="text-sm text-slate-600">{t("ads.error")} <button type="button" className="underline" onClick={() => setRetry((value) => value + 1)}>{t("admin.retry")}</button></p></aside>;
  if (!visible.length) return null;
  return <aside aria-label={t("ads.title")} className="mx-auto my-10 w-full max-w-7xl px-4 sm:px-6">
    <h2 className="mb-5 text-2xl font-bold text-[var(--color-primary)]">{t("ads.title")}</h2>
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map((ad) => <a key={ad.id} href={ad.targetUrl} target="_blank" rel="sponsored noopener noreferrer" className="saiway-reveal saiway-experience min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-700">
      {ad.image && <AdvertisingImage key={`${ad.id}-${ad.image.updatedAt}`} id={ad.id} version={ad.image.updatedAt} title={ad.title} />}
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{t("ads.sponsored")} · {ad.advertiser}</p>
      <h3 className="mt-2 break-words text-lg font-bold text-[var(--color-primary)]">{ad.title}</h3>
      <p className="mt-2 break-words text-sm leading-6 text-slate-600">{ad.description}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-800">{t("ads.visit")} <ExternalLink size={16} aria-hidden="true" /></span>
    </a>)}</div>
  </aside>;
}
