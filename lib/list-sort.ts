export type SortDirection = "asc" | "desc";
export type SortState = { key: string; direction: SortDirection };
export type SortField<T> = { key: string; label: string; value: (item: T) => string | number | null | undefined };

export function sortList<T>(items: readonly T[], field: SortField<T>, direction: SortDirection, locale: string): T[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: "base" });
  return items.map((item, index) => ({ item, index, value: field.value(item) })).sort((a, b) => {
    const missingA = a.value == null || typeof a.value === "number" && !Number.isFinite(a.value);
    const missingB = b.value == null || typeof b.value === "number" && !Number.isFinite(b.value);
    if (missingA || missingB) return missingA === missingB ? a.index - b.index : missingA ? 1 : -1;
    const comparison = typeof a.value === "number" && typeof b.value === "number"
      ? a.value - b.value : collator.compare(String(a.value), String(b.value));
    return comparison * (direction === "asc" ? 1 : -1) || a.index - b.index;
  }).map(({ item }) => item);
}

export function sortDate(value: string | null | undefined): number | null {
  return value ? Date.parse(value) : null;
}
