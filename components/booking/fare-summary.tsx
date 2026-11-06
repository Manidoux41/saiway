"use client";

import { useLanguage } from "@/components/i18n/language-provider";
import type { FareDetails } from "@/lib/fare-policy";

export function FareSummary({ details }: { details?: FareDetails | null }) {
  const { t, language } = useLanguage();
  if (!details) return null;
  const dollars = (value: number) => new Intl.NumberFormat(language, { style: "currency", currency: "USD" }).format(value / 100);
  return <div className="my-3 space-y-1 rounded-xl border border-slate-200 p-3 text-sm">
    <strong>{t(details.mode === "CITY" ? "fare.city" : details.mode === "TOUR" ? "fare.tour" : "fare.airport")}</strong>
    {details.mode === "CITY" && <p>{details.distanceMeters === null ? "—" : (details.distanceMeters / 1000).toFixed(2)} km · {dollars(details.policy.cityCentsPerKm)}/km · {t(details.distanceSource === "GPS" ? "fare.measured" : details.distanceSource === "CONFIRMED_ROUTE" ? "fare.confirmedRoute" : "fare.estimated")}</p>}
    {details.mode === "TOUR" && <>
      <p>{t(details.circuit === "GRAND" ? "fare.grand" : details.circuit === "REMOTE" ? "fare.remote" : "fare.small")} · {details.policy.tourIncludedHours} h{details.circuit === "SMALL" ? ` · ${details.policy.tourIncludedKm} km` : ""}</p>
      <p>{t("fare.waitIncluded")} · {t("fare.mealIncluded")} · {t("fare.waterIncluded")}</p>
      <p>{t("fare.extraHours")}: {details.extraHours} × {dollars(details.policy.tourExtraHourCents)}</p>
      <p>{t("fare.tourNotice")}</p>
    </>}
    {!details.finalized && <p>{t("fare.pendingFinal")}</p>}
  </div>;
}
