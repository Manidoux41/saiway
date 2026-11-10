"use client";

import { useState } from "react";
import { useLanguage } from "@/components/i18n/language-provider";
import { sortList, type SortField, type SortState } from "@/lib/list-sort";

export function ListSort({ fields, value, onChange }: { fields: readonly { key: string; label: string }[]; value: SortState; onChange: (value: SortState) => void }) {
  const { t } = useLanguage();
  const input = "mt-1 w-full min-w-0 rounded-xl border bg-white p-3 text-slate-900";
  return <div className="my-4 grid min-w-0 gap-3 text-sm sm:grid-cols-2" role="group" aria-label={t("sorting.controls")}>
    <label className="min-w-0">{t("sorting.by")}<select className={input} value={value.key} onChange={(event) => onChange({ ...value, key: event.target.value })}>{fields.map((field) => <option key={field.key} value={field.key}>{field.label}</option>)}</select></label>
    <label className="min-w-0">{t("sorting.direction")}<select className={input} value={value.direction} onChange={(event) => onChange({ ...value, direction: event.target.value === "asc" ? "asc" : "desc" })}><option value="asc">{t("sorting.asc")}</option><option value="desc">{t("sorting.desc")}</option></select></label>
  </div>;
}

export function useListSort<T>(items: readonly T[], fields: readonly [SortField<T>, ...SortField<T>[]], initial: SortState) {
  const { language } = useLanguage();
  const [sort, setSort] = useState(initial);
  const field = fields.find((field) => field.key === sort.key) ?? fields[0];
  return { items: sortList(items, field, sort.direction, language), controls: <ListSort fields={fields} value={{ ...sort, key: field.key }} onChange={setSort} /> };
}
