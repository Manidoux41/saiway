"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { InstallButton } from "@/components/pwa/install-button";
import { useLanguage } from "@/components/i18n/language-provider";

export default function InstallPage() {
  const { t } = useLanguage();
  const appUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://saiway.app/";
    return `${window.location.origin}/`;
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="min-w-0 rounded-[32px] bg-[var(--color-primary-dark)] p-5 text-white sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">SAIWAY</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">{t("ui.installTitle")}</h1>
          <p className="mt-5 leading-7 text-white/80">{t("ui.installScan")}</p>
          <div className="mt-8 space-y-4 text-sm text-white/85"><div>{t("ui.android")}</div><div>{t("ui.iphone")}</div></div>
        </section>

        <section className="min-w-0 rounded-[32px] border border-black/5 bg-white p-5 text-center shadow-sm sm:p-8">
          <div className="mx-auto flex w-full max-w-[288px] rounded-[28px] border-8 border-[var(--color-primary)] bg-white p-4 shadow-lg">
            <QRCodeSVG value={appUrl} size={240} className="h-auto w-full" bgColor="#ffffff" fgColor="#101b3d" level="H" includeMargin />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">{t("ui.scan")}</p>
          <p className="mx-auto mt-3 max-w-md break-all text-xs text-slate-500">{appUrl}</p>
          <InstallButton />
          <Link href="/" className="mt-6 inline-flex rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">{t("ui.open")}</Link>
        </section>
      </div>
    </div>
  );
}
