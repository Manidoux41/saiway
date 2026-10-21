"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { z } from "zod";
import { Check, IdCard, ImageOff, Upload } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import styles from "./driver-dashboard.module.css";

const sides = ["FRONT", "BACK"] as const;
const maxBytes = 5 * 1024 * 1024;
const imageSchema = z.object({ side: z.enum(sides), mimeType: z.string(), sizeBytes: z.number(), uploadedAt: z.string() });
const licenseSchema = z.object({ license: z.object({ id: z.string(), licenseNo: z.string().nullable(), licenseExpiresAt: z.string().nullable(), licenseImages: z.array(imageSchema) }) });
type License = z.infer<typeof licenseSchema>["license"];

export function DriverLicenseCard() {
  const { t, language } = useLanguage();
  const [license, setLicense] = useState<License | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState<(typeof sides)[number] | null>(null);
  const formatDate = (value: string, time = false) => new Intl.DateTimeFormat(language, { dateStyle: "medium", ...(time ? { timeStyle: "short" } : { timeZone: "UTC" }) }).format(new Date(value));

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/driver/license", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("License unavailable");
        setLicense(licenseSchema.parse(await response.json()).license);
      })
      .catch(() => { if (!controller.signal.aborted) setError(t("license.error")); });
    return () => controller.abort();
  }, [t]);

  async function upload(side: (typeof sides)[number], event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;
    setMessage(""); setError("");
    if (file.size > maxBytes) { setError(t("license.tooLarge")); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setError(t("license.badType")); return; }
    const body = new FormData();
    body.set("side", side); body.set("file", file);
    setUploading(side);
    try {
      const response = await fetch("/api/driver/license", { method: "POST", body });
      if (response.status === 413) throw new Error("license.tooLarge");
      if (response.status === 415) throw new Error("license.badType");
      if (!response.ok) throw new Error("license.error");
      const { image } = z.object({ image: imageSchema }).parse(await response.json());
      setLicense((current) => current && { ...current, licenseImages: [...current.licenseImages.filter((item) => item.side !== side), image] });
      setMessage(t("license.saved"));
    } catch (reason) {
      const key = reason instanceof Error && ["license.tooLarge", "license.badType"].includes(reason.message) ? reason.message as "license.tooLarge" | "license.badType" : "license.error";
      setError(t(key));
    } finally { setUploading(null); }
  }

  return <section className={styles.license} aria-labelledby="driver-license-title" aria-busy={!license && !error}>
    <h2 id="driver-license-title"><IdCard size={18} aria-hidden="true" />{t("license.title")}</h2>
    <p>{t("license.intro")}</p>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {message && <p role="status" className={styles.success}><Check size={16} />{message}</p>}
    {!license && !error && <p role="status">{t("license.loading")}</p>}
    {license && <>
      <dl className={styles.licenseFacts}>
        <div><dt>{t("license.number")}</dt><dd>{license.licenseNo || "—"}</dd></div>
        <div><dt>{t("license.expiry")}</dt><dd>{license.licenseExpiresAt ? formatDate(license.licenseExpiresAt) : "—"}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-slate-500">{t("license.adminManaged")}</p>
      <div className={styles.licenseSides}>
        {sides.map((side) => {
          const image = license.licenseImages.find((item) => item.side === side);
          return <div key={side} className={styles.licenseSide}>
            <h3>{t(`license.${side}`)}</h3>
            {image
              // eslint-disable-next-line @next/next/no-img-element -- private, authenticated, uncached image
              ? <img src={`/api/drivers/${license.id}/license/${side}?v=${encodeURIComponent(image.uploadedAt)}`} alt={`${t("license.title")} · ${t(`license.${side}`)}`} />
              : <div className={styles.licensePlaceholder}><ImageOff size={26} aria-hidden="true" />{t("license.missing")}</div>}
            {image && <small>{t("license.uploaded")} {formatDate(image.uploadedAt, true)}</small>}
            <label className={styles.licenseUpload} aria-disabled={uploading !== null}>
              <Upload size={16} aria-hidden="true" />{uploading === side ? t("admin.saving") : t(image ? "license.replace" : "license.upload")}
              <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" disabled={uploading !== null} onChange={(event) => void upload(side, event)} aria-label={`${t(image ? "license.replace" : "license.upload")} · ${t(`license.${side}`)}`} />
            </label>
            <small>{t("license.rules")}</small>
          </div>;
        })}
      </div>
    </>}
  </section>;
}
