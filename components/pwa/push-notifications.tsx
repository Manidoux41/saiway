"use client";

import { Bell, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAuth } from "@/components/auth/auth-provider";
import { useLanguage, type TranslationKey } from "@/components/i18n/language-provider";

type Configuration = { publicKey: string | null; subscription: { id: string; language: string } | null };
function applicationKey(value: string) {
  const bytes = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bytes, (letter) => letter.charCodeAt(0));
}
async function registration() {
  const worker = await navigator.serviceWorker.register("/sw.js");
  if (worker.active) return worker;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Service worker unavailable")), 10_000)),
  ]);
}
async function configuration(endpoint?: string): Promise<Configuration> {
  const response = await fetch(`/api/notifications/subscriptions${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ""}`, { cache: "no-store" });
  if (!response.ok) throw new Error("Notification configuration unavailable");
  return response.json();
}

export function PushNotifications() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [pending, setPending] = useState(true);
  const [message, setMessage] = useState<TranslationKey | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const available = window.isSecureContext && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    async function sync() {
      try {
        const worker = available ? await registration() : null;
        const subscription = await worker?.pushManager.getSubscription();
        const config = await configuration(subscription?.endpoint);
        if (subscription && config.subscription && Notification.permission === "granted") {
          const value = subscription.toJSON();
          const response = await fetch("/api/notifications/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: value.endpoint, keys: value.keys, language }) });
          if (!response.ok) throw new Error("Notification language update failed");
        }
        if (!cancelled) {
          setSupported(available); setPublicKey(config.publicKey);
          setEnabled(Boolean(subscription && config.subscription));
          setMessage(subscription && config.subscription && Notification.permission !== "granted" ? "push.denied" : null);
        }
      } catch {
        if (!cancelled) setMessage("push.error");
      } finally { if (!cancelled) setPending(false); }
    }
    void sync();
    return () => { cancelled = true; };
  }, [user?.id, user, language]);

  async function change(action: "enable" | "disable" | "test") {
    if (pending) return;
    setPending(true); setMessage(null);
    try {
      if (action === "enable" && await Notification.requestPermission() !== "granted") {
        setMessage("push.denied"); return;
      }
      const worker = await registration();
      let subscription = await worker.pushManager.getSubscription();
      if (action === "enable") {
        if (!publicKey) { setMessage("push.unconfigured"); return; }
        if (subscription && !(await configuration(subscription.endpoint)).subscription) {
          if (!await subscription.unsubscribe()) throw new Error("Old device subscription could not be removed");
          subscription = null;
        }
        subscription ??= await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(publicKey) });
        const value = subscription.toJSON();
        const response = await fetch("/api/notifications/subscriptions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: value.endpoint, keys: value.keys, language }) });
        if (!response.ok) throw new Error("Push subscription save failed");
        setEnabled(true); setMessage("push.enabled");
      } else if (action === "disable") {
        if (subscription) {
          const response = await fetch("/api/notifications/subscriptions", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
          if (!response.ok) throw new Error("Push subscription removal failed");
          if (!await subscription.unsubscribe()) throw new Error("Browser unsubscribe failed");
        }
        for (const notification of await worker.getNotifications()) notification.close();
        setEnabled(false); setMessage("push.disabled");
      } else {
        if (!subscription) throw new Error("Push subscription missing");
        const response = await fetch("/api/notifications/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        if (!response.ok) throw new Error("Push test unavailable");
        setMessage("push.queued");
      }
    } catch {
      setMessage("push.error");
    } finally { setPending(false); }
  }

  if (!user) return null;
  return <>
    <button type="button" aria-label={t("push.title")} title={t("push.title")} aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-full border border-slate-200 p-2 text-[var(--color-primary)]"><Bell size={20} aria-hidden="true" /></button>
    {open && createPortal(<dialog ref={dialog} onCancel={() => setOpen(false)} aria-labelledby="push-title" className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-2xl bg-white p-0 backdrop:bg-slate-950/60">
      <section className="w-full max-w-lg space-y-4 rounded-2xl bg-white p-5 shadow-xl">
        <header className="flex items-center justify-between gap-3"><h2 id="push-title" className="text-lg font-bold">{t("push.title")}</h2><button type="button" onClick={() => setOpen(false)} aria-label={t("push.closed")}><X aria-hidden="true" /></button></header>
        <p className="text-sm">{t("push.help")}</p>
        {user.role === "admin" && <p className="text-sm">{t("push.adminHelp")}</p>}
        <p role="status" className="text-sm">{t(pending ? "push.loading" : !supported ? "push.unsupported" : !publicKey ? "push.unconfigured" : enabled ? "push.enabled" : "push.disabled")}</p>
        {message && <p role={message === "push.error" || message === "push.denied" ? "alert" : "status"} className="text-sm">{t(message)}</p>}
        <div className="flex flex-wrap gap-3">
          <button type="button" disabled={pending || !supported || (!enabled && !publicKey)} onClick={() => void change(enabled ? "disable" : "enable")} className="rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t(enabled ? "push.disable" : "push.enable")}</button>
          {enabled && <button type="button" disabled={pending || !publicKey} onClick={() => void change("test")} className="rounded-full border px-4 py-2 text-sm">{t("push.test")}</button>}
        </div>
      </section>
    </dialog>, document.body)}
  </>;
}
