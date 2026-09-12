"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-[30px] border border-black/5 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">{t("about.eyebrow")}</p>
        <h1 className="mt-4 text-4xl font-black tracking-[-0.05em] text-[var(--color-text)]">
          {t("about.title")}
        </h1>
        <p className="mt-6 text-lg leading-8 text-slate-600">
          {t("about.text")}
        </p>
      </div>
    </div>
  );
}
