"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { createPortal, flushSync } from "react-dom";
import { QRCodeSVG } from "qrcode.react";
import { Camera, Download, Printer, QrCode, Trash2 } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { adminErrorKey, adminRequest, type ManagementData } from "@/lib/admin-client";
import { Logo } from "@/components/branding/logo";
import { contactQrChannels, contactQrImageUrl, type ContactQrChannel } from "@/lib/driver-contact-qr-client";
import { AngkorWatBackground } from "@/components/branding/angkor-wat-background";
import { ContactBrandLogo } from "@/components/branding/contact-brand-logo";
import styles from "@/components/admin/driver-business-card.module.css";

const maxPhotoBytes = 5 * 1024 * 1024;
type Driver = { id: string; name: string; phone: string; photoVersion: string | null; contactQrImages: { channel: ContactQrChannel; uploadedAt: string }[] };

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");

function DriverBusinessCard({ driver, bookingUrl }: { driver: Driver; bookingUrl: string }) {
  const { t } = useLanguage();
  return <article className={styles.card} aria-label={`${t("cards.title")} · ${driver.name}`}>
    <AngkorWatBackground className={styles.landscape} />
    <div className={styles.band}><div className={styles.brand}><Logo compact /></div><span className={styles.tagline}>{t("cards.tagline")}</span></div>
    <p className={styles.business}>{t("cards.business")}</p>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {driver.photoVersion ? <img className={styles.photo} src={`/api/admin/drivers/${driver.id}/photo?v=${encodeURIComponent(driver.photoVersion)}`} alt={driver.name} /> : <div className={`${styles.photo} ${styles.placeholder}`} aria-hidden="true">{initials(driver.name)}</div>}
    <div className={styles.identity}>
      <p className={styles.name}>{driver.name}</p>
      <p className={styles.role}>{t("cards.role")}</p>
      <p className={styles.label}>{t("cards.bookWith")}</p>
      <p className={styles.phone}>{driver.phone}</p>
    </div>
    <div className={styles.qrRow}>
      <div className={styles.qr}><QRCodeSVG value={bookingUrl} marginSize={4} level="M" /><div className={styles.qrCaption}><ContactBrandLogo brand="SAIWAY" />SAIWAY</div></div>
      {driver.contactQrImages.map((image) => {
        const name = image.channel === "WHATSAPP" ? "WhatsApp" : "Telegram";
        return <div key={image.channel} className={styles.qr}>
          {/* eslint-disable-next-line @next/next/no-img-element -- preserve the full, privately uploaded QR image */}
          <img src={contactQrImageUrl(driver.id, image.channel, image.uploadedAt)} alt={`QR ${name}`} />
          <div className={styles.qrCaption}><ContactBrandLogo brand={image.channel} />{name}</div>
        </div>;
      })}
    </div>
  </article>;
}

export function DriverBusinessCards({ users, onChanged }: { users: ManagementData["users"]; onChanged: () => void }) {
  const { t, language } = useLanguage();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [printing, setPrinting] = useState<Driver[] | null>(null);
  const printRoot = useRef<HTMLDivElement>(null);
  const drivers = users.filter((item) => item.role === "DRIVER" && item.driver);
  const cards: (Driver | null)[] = drivers.map((item) => item.phone ? { id: item.driver!.id, name: item.name, phone: item.phone, photoVersion: item.driver!.photo?.uploadedAt ?? null, contactQrImages: item.driver!.contactQrImages ?? [] } : null);
  const ready = cards.filter((card): card is Driver => card !== null);
  const bookingUrl = `${typeof window === "undefined" ? "" : window.location.origin}/booking`;

  async function print(selection: Driver[]) {
    if (printing) return;
    setMessage(null);
    flushSync(() => setPrinting(selection));
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!printRoot.current) throw new Error("Print area missing");
      await Promise.race([
        Promise.all([document.fonts.ready, ...Array.from(printRoot.current.querySelectorAll("img"), (image) => image.decode())]),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error("Print image timeout")), 15_000); }),
      ]);
      window.print();
    } catch { setMessage({ tone: "error", text: t("cards.printError") }); }
    finally { clearTimeout(timeout); setPrinting(null); }
  }

  async function upload(driverId: string, event: ChangeEvent<HTMLInputElement>, channel?: ContactQrChannel) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file || busy !== null || printing) return;
    if (!file.size || file.size > maxPhotoBytes) { setMessage({ tone: "error", text: t("license.tooLarge") }); return; }
    setBusy(driverId); setMessage(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const endpoint = channel ? `/api/drivers/${driverId}/contact-qr/${channel}` : `/api/admin/drivers/${driverId}/photo`;
      const response = await fetch(endpoint, { method: "PUT", body, cache: "no-store" });
      if (!response.ok) setMessage({ tone: "error", text: t(response.status === 415 ? "license.badType" : response.status === 413 ? "license.tooLarge" : response.status === 403 ? "admin.sessionExpired" : channel ? "contactQr.error" : "cards.error") });
      else { setMessage({ tone: "ok", text: t(channel ? "contactQr.saved" : "cards.saved") }); onChanged(); }
    } catch { setMessage({ tone: "error", text: t(channel ? "contactQr.error" : "cards.error") }); }
    finally { setBusy(null); }
  }

  async function remove(driverId: string, channel?: ContactQrChannel) {
    if (busy !== null || printing) return;
    setBusy(driverId); setMessage(null);
    try {
      await adminRequest(channel ? `/api/drivers/${driverId}/contact-qr/${channel}` : `/api/admin/drivers/${driverId}/photo`, { method: "DELETE" });
      setMessage({ tone: "ok", text: t(channel ? "contactQr.deleted" : "cards.photoDeleted") });
      onChanged();
    }
    catch (error) { setMessage({ tone: "error", text: t(adminErrorKey(error)) }); }
    finally { setBusy(null); }
  }

  async function download(driverId?: string) {
    if (busy !== null || printing) return;
    setBusy(driverId ?? "pdf-all"); setMessage(null);
    try {
      const endpoint = driverId ? `/api/admin/drivers/${driverId}/business-card` : "/api/admin/business-cards";
      const response = await fetch(`${endpoint}?language=${language}`, { cache: "no-store" });
      if (response.status === 403) { setMessage({ tone: "error", text: t("admin.sessionExpired") }); return; }
      if (!response.ok || response.headers.get("content-type") !== "application/pdf") throw new Error("Invalid PDF response");
      const blob = await response.blob();
      if (await blob.slice(0, 5).text() !== "%PDF-") throw new Error("Invalid PDF document");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = driverId ? "saiway-business-card.pdf" : "saiway-business-cards-a4.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch { setMessage({ tone: "error", text: t("cards.pdfError") }); }
    finally { setBusy(null); }
  }

  return <section className="rounded-[28px] bg-white p-6 shadow-sm" aria-labelledby="driver-cards-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="driver-cards-title" className="text-xl font-bold">{t("cards.title")}</h2><p className="mt-2 text-sm text-slate-500">{t("cards.intro")}</p><p className="mt-2 text-sm text-slate-500">{t("cards.contactIntro")}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!ready.length || printing !== null || busy !== null} onClick={() => void download()} className="inline-flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Download size={16} aria-hidden="true" />{t(busy === "pdf-all" ? "cards.preparingPdf" : "cards.downloadAll")}</button>
        <button type="button" disabled={!ready.length || printing !== null || busy !== null} onClick={() => void print(ready)} className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-[var(--color-primary)] disabled:opacity-50"><Printer size={16} aria-hidden="true" />{t("cards.printAll")}</button>
      </div>
    </div>
    {message && <p role={message.tone === "error" ? "alert" : "status"} className={`mt-4 text-sm font-semibold ${message.tone === "error" ? "text-[var(--color-error)]" : "text-emerald-700"}`}>{message.text}</p>}
    <div className="mt-5 grid gap-6 lg:grid-cols-2">{drivers.map((item, index) => {
      const card = cards[index];
      const driver = item.driver!;
      return <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
        {card ? <div className="overflow-x-auto"><DriverBusinessCard driver={card} bookingUrl={bookingUrl} /></div> : <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-800"><strong>{item.name}</strong><br />{t("cards.noPhone")}</div>}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-[var(--color-primary)] ${busy !== null || printing ? "pointer-events-none opacity-50" : ""}`}><Camera size={15} aria-hidden="true" />{t(driver.photo ? "cards.replacePhoto" : "cards.addPhoto")}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy !== null || printing !== null} onChange={(event) => void upload(driver.id, event)} aria-label={`${t(driver.photo ? "cards.replacePhoto" : "cards.addPhoto")} · ${item.name}`} /></label>
          {driver.photo && <button type="button" disabled={busy !== null || printing !== null} onClick={() => void remove(driver.id)} className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 font-semibold text-[var(--color-error)] disabled:opacity-50"><Trash2 size={15} aria-hidden="true" />{t("cards.removePhoto")}</button>}
          {card && <button type="button" disabled={printing !== null || busy !== null} onClick={() => void download(driver.id)} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-1.5 font-semibold text-white disabled:opacity-50"><Download size={15} aria-hidden="true" />{t(busy === driver.id ? "cards.preparingPdf" : "cards.downloadPdf")}</button>}
          {card && <button type="button" disabled={printing !== null || busy !== null} onClick={() => void print([card])} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary)] px-3 py-1.5 font-semibold text-white disabled:opacity-50"><Printer size={15} aria-hidden="true" />{t("cards.print")}</button>}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">{contactQrChannels.map((channel) => {
          const image = driver.contactQrImages?.find((entry) => entry.channel === channel);
          const name = channel === "WHATSAPP" ? "WhatsApp" : "Telegram";
          return <div key={channel} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-bold"><QrCode size={16} aria-hidden="true" />{name}</h3>
            <label className={`inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--color-primary)] ${busy !== null || printing ? "pointer-events-none opacity-50" : ""}`}>
              <Camera size={15} aria-hidden="true" />{t(image ? "contactQr.replace" : "contactQr.upload")}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy !== null || printing !== null} onChange={(event) => void upload(driver.id, event, channel)} aria-label={`${t(image ? "contactQr.replace" : "contactQr.upload")} · ${name} · ${item.name}`} />
            </label>
            {image && <button type="button" disabled={busy !== null || printing !== null} className="mt-2 flex items-center gap-1 text-sm font-semibold text-[var(--color-error)] disabled:opacity-50" aria-label={`${t("contactQr.remove")} · ${name} · ${item.name}`} onClick={() => void remove(driver.id, channel)}><Trash2 size={14} aria-hidden="true" />{t("contactQr.remove")}</button>}
            <small className="mt-2 block text-xs text-slate-500">{t("license.rules")}</small>
          </div>;
        })}</div>
      </div>;
    })}</div>
    {!drivers.length && <p className="mt-4 text-slate-500">{t("license.noDrivers")}</p>}
    {printing && createPortal(<div ref={printRoot} className="driver-cards-print-root">{printing.map((driver) => <DriverBusinessCard key={driver.id} driver={driver} bookingUrl={bookingUrl} />)}</div>, document.body)}
  </section>;
}
