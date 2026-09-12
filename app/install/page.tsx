"use client";

import { useMemo } from "react";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { InstallButton } from "@/components/pwa/install-button";

export default function InstallPage() {
  const appUrl = useMemo(() => {
    if (typeof window === "undefined") return "https://saiway.app/";
    return `${window.location.origin}/`;
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[32px] bg-[var(--color-primary-dark)] p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70">SAIWAY mobile</p>
          <h1 className="mt-4 text-4xl font-black tracking-[-0.05em]">Install SAIWAY on your phone.</h1>
          <p className="mt-5 leading-7 text-white/80">Scan this QR Code with your phone. The SAIWAY web app will open in your browser and can then be added to your home screen.</p>
          <div className="mt-8 space-y-4 text-sm text-white/85"><div><strong>Android:</strong> open the browser menu, then choose “Install app” or “Add to Home screen”.</div><div><strong>iPhone:</strong> tap Share in Safari, then choose “Add to Home Screen”.</div></div>
        </section>

        <section className="rounded-[32px] border border-black/5 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto inline-flex rounded-[28px] border-8 border-[var(--color-primary)] bg-white p-4 shadow-lg">
            <QRCodeSVG value={appUrl} size={240} bgColor="#ffffff" fgColor="#101b3d" level="H" includeMargin />
          </div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">Scan to install</p>
          <p className="mx-auto mt-3 max-w-md break-all text-xs text-slate-500">{appUrl}</p>
          <InstallButton />
          <Link href="/" className="mt-6 inline-flex rounded-full bg-[var(--color-accent)] px-5 py-3 text-sm font-semibold text-white">Open SAIWAY</Link>
        </section>
      </div>
    </div>
  );
}
