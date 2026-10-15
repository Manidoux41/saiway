"use client";

import { CourseDashboard } from "@/components/booking/course-dashboard";
import { useLanguage } from "@/components/i18n/language-provider";
import { ChangePasswordForm } from "@/components/auth/change-password-form";

export default function DriverPage() {
  const { t } = useLanguage();
  return <div className="mx-auto max-w-5xl px-4 py-12"><h1 className="text-3xl font-black">{t("nav.driverDashboard")}</h1><p className="mt-3 text-slate-600">{t("courses.driverScope")}</p><ChangePasswordForm /><CourseDashboard role="driver" /></div>;
}
