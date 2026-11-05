"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { QrCode, Trash2, Upload } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import { contactQrChannels, contactQrImageSchema, contactQrImageUrl, contactQrSummarySchema, type ContactQrChannel } from "@/lib/driver-contact-qr-client";
import styles from "./driver-dashboard.module.css";

type Driver = z.infer<typeof contactQrSummarySchema>["driver"];
const maxBytes = 5 * 1024 * 1024;

export function DriverContactQrCard() {
  const { t } = useLanguage();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<ContactQrChannel | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/driver/contact-qr", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Contact QR unavailable");
        const result = contactQrSummarySchema.parse(await response.json());
        if (!controller.signal.aborted) { setDriver(result.driver); setError(""); }
      })
      .catch(() => { if (!controller.signal.aborted) setError(t("contactQr.error")); });
    return () => controller.abort();
  }, [t, version]);

  async function upload(channel: ContactQrChannel, event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || pending || !driver) return;
    setError(""); setMessage("");
    if (!file.size || file.size > maxBytes) { setError(t("license.tooLarge")); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError(t("license.badType")); return; }
    const body = new FormData();
    body.set("file", file);
    setPending(channel);
    try {
      const response = await fetch(`/api/drivers/${driver.id}/contact-qr/${channel}`, { method: "PUT", body });
      if (response.status === 413) { setError(t("license.tooLarge")); return; }
      if (response.status === 415) { setError(t("license.badType")); return; }
      if (!response.ok) throw new Error("Contact QR upload failed");
      const { image } = z.object({ image: contactQrImageSchema }).parse(await response.json());
      setDriver((current) => current && { ...current, contactQrImages: [...current.contactQrImages.filter((item) => item.channel !== channel), image] });
      setMessage(t("contactQr.saved"));
    } catch { setError(t("contactQr.error")); }
    finally { setPending(null); }
  }

  async function remove(channel: ContactQrChannel) {
    if (pending || !driver) return;
    setPending(channel); setError(""); setMessage("");
    try {
      const response = await fetch(`/api/drivers/${driver.id}/contact-qr/${channel}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Contact QR deletion failed");
      setDriver((current) => current && { ...current, contactQrImages: current.contactQrImages.filter((item) => item.channel !== channel) });
      setMessage(t("contactQr.deleted"));
    } catch { setError(t("contactQr.error")); }
    finally { setPending(null); }
  }

  return <section className={styles.license} aria-labelledby="driver-contact-qr-title" aria-busy={pending !== null || !driver && !error}>
    <h2 id="driver-contact-qr-title"><QrCode size={18} aria-hidden="true" />{t("contactQr.title")}</h2>
    <p>{t("contactQr.intro")}</p>
    <p>{t("contactQr.instructions")}</p>
    {error && <p role="alert" className={styles.error}>{error} <button type="button" disabled={pending !== null} className="underline" onClick={() => setVersion((value) => value + 1)}>{t("admin.retry")}</button></p>}
    {message && <p role="status" className={styles.success}>{message}</p>}
    {!driver && !error && <p role="status">{t("license.loading")}</p>}
    {driver && <div className={styles.licenseSides}>{contactQrChannels.map((channel) => {
      const image = driver.contactQrImages.find((item) => item.channel === channel);
      const name = channel === "WHATSAPP" ? "WhatsApp" : "Telegram";
      return <div key={channel} className={styles.licenseSide}>
        <h3>{name}</h3>
        {image
          // eslint-disable-next-line @next/next/no-img-element -- authenticated image; retain the full QR and its quiet zone
          ? <img src={contactQrImageUrl(driver.id, channel, image.uploadedAt)} alt={`QR ${name}`} style={{ objectFit: "contain", background: "white" }} onError={() => setError(t("contactQr.error"))} />
          : <div className={styles.licensePlaceholder}><QrCode size={26} aria-hidden="true" />{t("license.missing")}</div>}
        <label className={styles.licenseUpload} aria-disabled={pending !== null}>
          <Upload size={16} aria-hidden="true" />{pending === channel ? t("admin.saving") : t(image ? "contactQr.replace" : "contactQr.upload")}
          <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={pending !== null} onChange={(event) => void upload(channel, event)} aria-label={`${t(image ? "contactQr.replace" : "contactQr.upload")} · ${name}`} />
        </label>
        {image && <button type="button" disabled={pending !== null} onClick={() => void remove(channel)} className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-error)] disabled:opacity-50"><Trash2 size={15} aria-hidden="true" />{t("contactQr.remove")} · {name}</button>}
        <small>{t("license.rules")}</small>
      </div>;
    })}</div>}
  </section>;
}
