"use client";

import { useState } from "react";
import { ExternalLink, IdCard } from "lucide-react";
import { useLanguage } from "@/components/i18n/language-provider";
import type { ManagementData } from "@/lib/admin-client";

const sides = ["FRONT", "BACK"] as const;

export function DriverLicenses({ users }: { users: ManagementData["users"] }) {
  const { t, language } = useLanguage();
  const [now] = useState(() => Date.now());
  const drivers = users.filter((item) => item.role === "DRIVER" && item.driver);
  const date = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(language, options).format(new Date(value));

  return <section className="rounded-[28px] bg-white p-6 shadow-sm" aria-labelledby="driver-licenses-title">
    <h2 id="driver-licenses-title" className="flex items-center gap-2 text-xl font-bold"><IdCard size={20} aria-hidden="true" />{t("license.adminTitle")}</h2>
    <p className="mt-2 text-sm text-slate-500">{t("license.adminIntro")}</p>
    <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-sm">
      <thead><tr><th>{t("license.driver")}</th><th>{t("license.number")}</th><th>{t("license.expiry")}</th><th>{t("license.photos")}</th><th>{t("records.status")}</th></tr></thead>
      <tbody>{drivers.map((item) => {
        const driver = item.driver!;
        const images = driver.licenseImages ?? [];
        const expired = driver.licenseExpiresAt ? new Date(driver.licenseExpiresAt).getTime() < now : false;
        const complete = Boolean(driver.licenseNo && driver.licenseExpiresAt && !expired && sides.every((side) => images.some((image) => image.side === side)));
        return <tr key={item.id} className="border-t align-top">
          <td className="py-3"><strong>{item.name}</strong><small className="block text-slate-500">{item.email}{item.phone ? ` · ${item.phone}` : ""}</small></td>
          <td className="py-3">{driver.licenseNo || "—"}</td>
          <td className={`py-3 ${expired ? "font-semibold text-[var(--color-error)]" : ""}`}>{driver.licenseExpiresAt ? date(driver.licenseExpiresAt, { dateStyle: "medium", timeZone: "UTC" }) : "—"}{expired && <small className="block">{t("license.expired")}</small>}</td>
          <td className="py-3"><div className="flex flex-wrap gap-3">{sides.map((side) => {
            const image = images.find((entry) => entry.side === side);
            return image
              ? <a key={side} href={`/api/drivers/${driver.id}/license/${side}?v=${encodeURIComponent(image.uploadedAt)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--color-primary)] underline" title={date(image.uploadedAt, { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Phnom_Penh" })}>{t(`license.${side}`)}<ExternalLink size={13} aria-hidden="true" /></a>
              : <span key={side} className="text-slate-400">{t(`license.${side}`)} · {t("license.missing")}</span>;
          })}</div></td>
          <td className="py-3"><span className={`rounded-full px-3 py-1 text-xs font-semibold ${complete ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{t(complete ? "license.complete" : "license.incomplete")}</span></td>
        </tr>;
      })}</tbody>
    </table>{!drivers.length && <p className="py-4 text-slate-500">{t("license.noDrivers")}</p>}</div>
  </section>;
}
