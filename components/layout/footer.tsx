"use client";

import Link from "next/link";
import { Logo } from "@/components/branding/logo";
import { useLanguage } from "@/components/i18n/language-provider";

export function Footer() {
  const { t } = useLanguage();

  return (
    <footer className="mt-20 border-t border-black/5 bg-[var(--color-primary-dark)] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:px-8">
        <div>
          <Logo compact />
          <p className="mt-5 max-w-xs text-sm text-white/80">
            {t("footer.tagline")}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{t("footer.company")}</h3>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            <li><Link href="/about">{t("nav.about")}</Link></li>
            <li><Link href="/booking">{t("nav.book")}</Link></li>
            <li><Link href="/booking/track">{t("nav.track")}</Link></li>
            <li><Link href="/contact">{t("footer.contact")}</Link></li>
            <li><Link href="/install">Install app</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{t("footer.legal")}</h3>
          <ul className="mt-4 space-y-3 text-sm text-white/80">
            <li><Link href="/terms">{t("footer.terms")}</Link></li>
            <li><Link href="/privacy">{t("footer.privacy")}</Link></li>
            <li><Link href="/cancellation-policy">{t("footer.cancellation")}</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/70">{t("footer.languages")}</h3>
          <div className="mt-4 flex gap-2 text-sm text-white/80">
            <span className="rounded-full border border-white/20 px-3 py-1.5">English</span>
            <span className="rounded-full border border-white/20 px-3 py-1.5">Français</span>
            <span className="rounded-full border border-white/20 px-3 py-1.5">Khmer</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
