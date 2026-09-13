"use client";

import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { useLanguage, type Language } from "@/components/i18n/language-provider";

const languageOptions: { code: Language; flag: string; label: string }[] = [
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
  { code: "km", flag: "🇰🇭", label: "ខ្មែរ" },
];

export function Header() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <header className="sticky top-0 z-20 border-b-2 border-[var(--color-accent)] bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="SAIWAY home" className="flex items-center">
          <Logo compact />
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-700 md:flex">
          <Link href="/" className="transition hover:text-[var(--color-primary)]">{t("nav.book")}</Link>
          <Link href="/booking/track" className="transition hover:text-[var(--color-primary)]">{t("nav.track")}</Link>
          <Link href="/about" className="transition hover:text-[var(--color-primary)]">{t("nav.about")}</Link>
          <Link href="/help" className="transition hover:text-[var(--color-primary)]">{t("nav.help")}</Link>
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1" aria-label="Select language">
            {languageOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                onClick={() => setLanguage(option.code)}
                aria-label={option.label}
                aria-pressed={language === option.code}
                title={option.label}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-base transition ${language === option.code ? "bg-[var(--color-primary)]/10 ring-1 ring-[var(--color-primary)]/30" : "opacity-60 hover:opacity-100"}`}
              >
                <span aria-hidden="true">{option.flag}</span>
              </button>
            ))}
          </div>
          <Link href="/booking" className="inline-flex items-center justify-center rounded-full bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)]">
            {t("nav.bookNow")}
          </Link>
          <Link href="/account" className="text-sm font-semibold text-slate-600 transition hover:text-[var(--color-primary)]">Account</Link>
          <Link href="/install" aria-label="Install SAIWAY" title="Install SAIWAY" className="hidden text-sm font-semibold text-[var(--color-accent)] transition hover:text-[var(--color-primary)] lg:inline">Install app</Link>
        </div>
      </div>
    </header>
  );
}
