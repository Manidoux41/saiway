"use client";

import { useLanguage } from "@/components/i18n/language-provider";

export default function BlogError({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return <div role="alert" className="mx-auto max-w-4xl p-6"><p>{t("blog.unavailable")}</p><button type="button" className="mt-4 min-h-11 rounded-xl border bg-white px-4" onClick={reset}>{t("admin.retry")}</button></div>;
}
