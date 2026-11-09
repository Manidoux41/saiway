"use client";

import Image from "next/image";
import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { contactQrChannels, type ContactQrChannel } from "@/lib/driver-contact-qr-client";

function ContactQr({ channel, uploadedAt }: { channel: ContactQrChannel; uploadedAt?: string }) {
  const { t } = useLanguage();
  const [failed, setFailed] = useState(false);
  const label = channel === "WHATSAPP" ? "WhatsApp" : "Telegram";
  const url = `/api/contact/qr/${channel}?v=${encodeURIComponent(uploadedAt ?? "")}`;
  return <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 text-center">
    <h3 className="text-xl font-bold">{label}</h3>
    {!uploadedAt || failed ? <p role={failed ? "alert" : "status"} className="mt-4 text-sm text-slate-600">{t(failed ? "contact.qrError" : "contact.qrMissing")}</p> : <>
      <Image src={url} alt={`${t("contact.qrAlt")} ${label}`} width={320} height={320} unoptimized loading="eager" onError={() => setFailed(true)} className="mx-auto my-4 h-auto w-full max-w-80 rounded-xl" />
      <p className="text-sm text-slate-600">{t("contact.scan")}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 font-semibold text-[var(--color-primary)]">{t("contact.openQr")}</a>
    </>}
  </section>;
}

export function ContactPage({ email, driver, error = false }: { email?: string; driver?: { name: string; images: { channel: ContactQrChannel; uploadedAt: string }[] } | null; error?: boolean }) {
  const { t } = useLanguage();
  return <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
    <header className="min-w-0 rounded-3xl bg-white p-5 shadow-sm sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-[var(--color-primary)]">SAIWAY</p>
      <h1 className="mt-3 break-words text-3xl font-black sm:text-4xl">{t("contact.title")}</h1>
      <p className="mt-4 text-slate-600">{t("contact.intro")}</p>
      {error ? <div role="alert" className="mt-6 text-red-700"><p>{t("contact.unavailable")}</p><a href="/contact" className="mt-3 inline-flex min-h-11 items-center underline">{t("admin.retry")}</a></div> : email && <a href={`mailto:${email}`} className="mt-6 inline-flex min-h-11 max-w-full items-center rounded-xl bg-[var(--color-primary)] px-4 py-3 font-semibold text-white"><span className="min-w-0 break-all">{email}</span></a>}
    </header>
    {!error && <section className="mt-8">
      <h2 className="break-words text-2xl font-bold">{driver ? `${t("contact.driver")} · ${driver.name}` : t("contact.driver")}</h2>
      <p className="mt-3 text-slate-600">{t("contact.help")}</p>
      {driver ? <div className="mt-5 grid min-w-0 gap-5 sm:grid-cols-2">{contactQrChannels.map((channel) => <ContactQr key={`${channel}-${driver.images.find((image) => image.channel === channel)?.uploadedAt ?? ""}`} channel={channel} uploadedAt={driver.images.find((image) => image.channel === channel)?.uploadedAt} />)}</div> : <p role="status" className="mt-5 rounded-2xl bg-white p-5 text-slate-600">{t("contact.noDriver")}</p>}
    </section>}
  </div>;
}
