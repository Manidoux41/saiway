"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";

const faqKeys = [
  ["help.bookingQuestion", "help.bookingAnswer"],
  ["help.accountQuestion", "help.accountAnswer"],
  ["help.airportQuestion", "help.airportAnswer"],
  ["help.changeQuestion", "help.changeAnswer"],
  ["help.trackQuestion", "help.trackAnswer"],
  ["help.paymentQuestion", "help.paymentAnswer"],
] as const;

export default function HelpPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <section className="rounded-[32px] bg-[var(--color-primary-dark)] p-8 text-white md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">{t("help.eyebrow")}</p>
        <h1 className="mt-3 text-4xl font-black tracking-[-0.05em]">{t("help.title")}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-white/80">{t("help.description")}</p>
      </section>

      <section className="mt-8 space-y-3" aria-label="Frequently asked questions">
        {faqKeys.map(([question, answer]) => (
          <details key={question} className="group rounded-2xl border border-black/5 bg-white p-5 shadow-sm">
            <summary className="cursor-pointer list-none pr-8 text-lg font-bold text-[var(--color-text)] marker:hidden">{t(question)}<span className="float-right text-[var(--color-primary)] transition group-open:rotate-45">+</span></summary>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">{t(answer)}</p>
          </details>
        ))}
      </section>

      <div className="mt-8 flex flex-col items-start justify-between gap-4 rounded-[28px] border border-[var(--color-accent)]/25 bg-[var(--color-accent)]/10 p-6 sm:flex-row sm:items-center">
        <p className="font-semibold text-[var(--color-text)]">{t("help.contact")}</p>
        <Link href="/booking" className="rounded-full bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white">{t("help.bookNow")}</Link>
      </div>
    </div>
  );
}