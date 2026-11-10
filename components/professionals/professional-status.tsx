"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/language-provider";
import type { Professional } from "@/lib/professional-policy";

export function ProfessionalStatus({ professional }: { professional: Professional }) {
  const { t } = useLanguage();
  return <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-5">
    <p className="text-sm font-bold text-blue-900">{t("pro.bookedBy")} · {professional.companyName}</p>
    <h2 className="text-xl font-bold">{t(`pro.${professional.status}`)}</h2>
    <p className="text-sm leading-6">{t(professional.status === "PENDING" ? "pro.pendingHelp" : professional.status === "APPROVED" ? "pro.bookingHelp" : "pro.blockedHelp")}</p>
    <p className="text-sm">{professional.contactName} · {professional.contactPhone}</p>
    <div className="flex flex-wrap gap-3">
      {professional.status === "APPROVED" && <Link href="/booking" className="rounded-xl bg-blue-900 px-4 py-3 font-bold text-white">{t("pro.book")}</Link>}
      <Link href="/account" className="rounded-xl border border-blue-200 bg-white px-4 py-3 font-bold text-blue-900">{t("pro.dashboard")}</Link>
      <Link href="/contact" className="rounded-xl px-4 py-3 font-semibold text-blue-900">{t("nav.help")}</Link>
    </div>
  </section>;
}
