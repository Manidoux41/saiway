"use client";

import { FormEvent, useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";

type MessageReason = "flightDelay" | "baggage" | "immigration" | "other";

export function DriverMessage({ bookingReference }: { bookingReference: string }) {
  const { t } = useLanguage();
  const [reason, setReason] = useState<MessageReason>("flightDelay");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSent(true);
  }

  return (
    <section className="mt-8 rounded-[28px] border border-[var(--color-primary)]/15 bg-white p-6 shadow-sm" aria-live="polite">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{t("message.eyebrow")}</p>
      <h2 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--color-text)]">{t("message.title")}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{t("message.description")}</p>

      {sent ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="font-semibold text-emerald-800">{t("message.sent")}</div>
          <div className="mt-1 text-sm text-emerald-700">{bookingReference} · {t("message.sentAt")}</div>
          <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-semibold text-emerald-800 underline">{t("message.send")}</button>
        </div>
      ) : (
        <form onSubmit={submitMessage} className="mt-6 space-y-4">
          <div>
            <label htmlFor="delay-reason" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("message.reason")}</label>
            <select id="delay-reason" value={reason} onChange={(event) => setReason(event.target.value as MessageReason)} className="w-full rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]">
              <option value="flightDelay">{t("message.flightDelay")}</option>
              <option value="baggage">{t("message.baggage")}</option>
              <option value="immigration">{t("message.immigration")}</option>
              <option value="other">{t("message.other")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="driver-note" className="mb-2 block text-sm font-semibold text-[var(--color-text)]">{t("message.placeholder")}</label>
            <textarea id="driver-note" value={note} onChange={(event) => setNote(event.target.value.slice(0, 280))} rows={3} maxLength={280} placeholder={t("message.placeholder")} className="w-full resize-none rounded-2xl border border-slate-200 bg-[var(--color-input)] px-4 py-3 text-sm text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]" />
            <div className="mt-1 text-right text-xs text-slate-400">{note.length}/280 {t("message.characters")}</div>
          </div>
          <button type="submit" className="w-full rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]">{t("message.send")}</button>
        </form>
      )}
    </section>
  );
}