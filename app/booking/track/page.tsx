"use client";

import { CourseDashboard } from "@/components/booking/course-dashboard";
import { useLanguage } from "@/components/i18n/language-provider";

export default function TrackingPage() {
  const { t } = useLanguage();
  return <div className="mx-auto max-w-5xl px-4 py-12"><h1 className="text-3xl font-black">{t("courses.customerTitle")}</h1><CourseDashboard role="customer" /></div>;
}
