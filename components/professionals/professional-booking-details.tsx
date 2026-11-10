"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export function ProfessionalBookingDetails({ course }: { course: { professionalCompany?: string | null; professionalPhone?: string | null; passengerName?: string | null; contactPhone?: string | null } }) {
  const { t } = useLanguage();
  if (!course.professionalCompany) return null;
  return <section className="m-3 space-y-2 break-words rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
    <h3 className="font-bold">{t("pro.bookedBy")} · {course.professionalCompany}</h3>
    <p>{t("pro.guest")} : <strong>{course.passengerName}</strong>{course.contactPhone ? ` · ${course.contactPhone}` : ""}</p>
    {course.professionalPhone && <a className="inline-flex min-h-11 items-center gap-2 font-semibold text-blue-900 underline" href={`tel:${course.professionalPhone.replace(/[^\d+]/g, "")}`}>{t("pro.contactHotel")} · {course.professionalPhone}</a>}
  </section>;
}
