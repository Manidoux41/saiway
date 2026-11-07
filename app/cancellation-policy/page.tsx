"use client";

import { localizedDate } from "@/lib/locale-format";
import { useLanguage } from "@/components/i18n/language-provider";
import { legalCopy } from "@/components/i18n/legal-copy";

const rules = [
  { timing: "More than 48 hours before pickup", result: "Full refund of the transfer fare." },
  { timing: "24 to 48 hours before pickup", result: "50% refund of the transfer fare." },
  { timing: "Less than 24 hours before pickup", result: "The fare is normally non-refundable." },
  { timing: "Passenger no-show", result: "No refund after the included waiting period has ended." },
];

export default function CancellationPolicyPage() {
  const { language } = useLanguage();
  const copy = language === "en" ? null : legalCopy[language];
  const policy = copy?.cancellation;
  const translatedRules = policy?.rules ?? rules;
  const updated = localizedDate(language, { dateStyle: "long", timeZone: "Asia/Phnom_Penh" }).format(new Date("2026-09-12T00:00:00Z"));
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-[30px] border border-black/5 bg-white p-6 shadow-sm md:p-10">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{copy?.legal ?? "Legal"}</p>
        <h1 className="mt-3 break-words text-3xl font-black tracking-[-0.05em] text-[var(--color-text)] sm:text-4xl">{policy?.title ?? "Cancellation Policy"}</h1>
        <p className="mt-3 text-sm text-slate-500">{copy?.updated ?? "Last updated"}: {updated}</p>
        <p className="mt-8 leading-7 text-slate-600">{policy?.intro ?? "This policy applies to SAIWAY private transfers unless different terms are clearly shown in your booking confirmation. It is intended to be read with Cambodia's Law on Consumer Protection (2019), Law on E-Commerce (2019), Road Traffic Law (2014), Civil Code and applicable passenger-transport requirements. Cancellation rights that are mandatory under Cambodian law remain unaffected."}</p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-slate-200">
          <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 break-words bg-[var(--color-primary-dark)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-white sm:px-5"><span>{policy?.when ?? "When you cancel"}</span><span>{policy?.refund ?? "Refund"}</span></div>
          {translatedRules.map((rule) => <div key={rule.timing} className="grid grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-4 break-words border-t border-slate-200 px-4 py-4 text-sm sm:px-5"><span className="font-semibold text-[var(--color-text)]">{rule.timing}</span><span className="text-slate-600">{rule.result}</span></div>)}
        </div>

        <div className="mt-10 space-y-8">
          {policy ? policy.sections.map(section => <section key={section.title}><h2 className="text-xl font-bold text-[var(--color-text)]">{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph} className="mt-3 leading-7 text-slate-600">{paragraph}</p>)}</section>) : <>
          <section><h2 className="text-xl font-bold text-[var(--color-text)]">How to cancel</h2><p className="mt-3 leading-7 text-slate-600">Use the cancellation contact shown in your confirmation and include your booking reference. The time we receive your cancellation request determines the applicable window. A cancellation is not complete until SAIWAY acknowledges it.</p></section>
          <section><h2 className="text-xl font-bold text-[var(--color-text)]">Changes and rescheduling</h2><p className="mt-3 leading-7 text-slate-600">Request a change as early as possible. We will try to accommodate a new date, time, route or passenger count, subject to availability and any fare difference. A material change may be treated as a cancellation and new booking.</p></section>
          <section><h2 className="text-xl font-bold text-[var(--color-text)]">Flight delays</h2><p className="mt-3 leading-7 text-slate-600">When a flight number is supplied, SAIWAY may monitor the scheduled arrival and try to adjust pickup. Extended delays, missed flights or a change that prevents the driver from completing the trip may be handled as a cancellation or no-show depending on the circumstances and the waiting terms in your confirmation.</p></section>
          <section><h2 className="text-xl font-bold text-[var(--color-text)]">When SAIWAY cancels</h2><p className="mt-3 leading-7 text-slate-600">If SAIWAY cancels a confirmed transfer and cannot provide a suitable replacement, you may choose a full refund of the amount paid for that transfer or an alternative arrangement agreed with us. Refund timing depends on the payment provider.</p></section>
          <section><h2 className="text-xl font-bold text-[var(--color-text)]">Exceptional circumstances</h2><p className="mt-3 leading-7 text-slate-600">We will consider reasonable alternatives where a trip is affected by severe weather, road closure, public emergency, government restriction or another event outside reasonable control. This policy does not remove any non-excludable right under Cambodian law.</p></section>
          </>}
        </div>
        <p className="mt-10 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-4 text-sm leading-6 text-[var(--color-text)]">{policy?.notice ?? "This policy is a customer-facing draft and should be checked by qualified Cambodian counsel against SAIWAY's final licence, operator structure, payment terms and consumer-protection obligations before launch."}</p>
      </div>
    </div>
  );
}
