import type { ManagementData } from "@/lib/admin-client";

export type LedgerRow = {
  id: string; type: string; category: string; label: string; amountCents: number;
  currency: string; date: string; sourceKey: string | null; vehicleId: string | null;
  historicalDate: boolean; paid: boolean;
};
export function ledgerRows(data: Pick<ManagementData, "entries" | "receipts">): LedgerRow[] {
  const recorded = new Set(data.entries.map((entry) => entry.sourceKey).filter(Boolean));
  const entries: LedgerRow[] = data.entries.filter((entry) => !entry.deletedAt).map((entry) => ({
    id: entry.id, type: entry.type, category: entry.category, label: entry.label,
    amountCents: entry.amountCents, currency: entry.currency, date: entry.entryDate,
    sourceKey: entry.sourceKey, vehicleId: entry.vehicleId, historicalDate: false,
    paid: entry.paidAt !== null,
  }));
  for (const receipt of data.receipts) {
    if (recorded.has(`payment:${receipt.id}`)) continue;
    entries.push({
      id: `payment:${receipt.id}`, type: "REVENUE", category: "TRIP", label: receipt.booking.reference,
      amountCents: receipt.amountCents, currency: receipt.currency,
      date: receipt.confirmedAt ?? receipt.updatedAt, sourceKey: `payment:${receipt.id}`,
      vehicleId: receipt.booking.vehicleId, historicalDate: receipt.confirmedAt === null, paid: true,
    });
  }
  return entries;
}

export function accountingMonth(date: string) {
  return new Date(Date.parse(date) + 7 * 3_600_000).toISOString().slice(0, 7);
}

export function contractPeriod(contract: { status: string; startsAt: string; endsAt: string | null }, now = Date.now()) {
  if (contract.status !== "ACTIVE" || contract.endsAt && Date.parse(contract.endsAt) < now) return "PAST";
  return Date.parse(contract.startsAt) > now ? "UPCOMING" : "CURRENT";
}

export function accountingBalance(rows: LedgerRow[], currency = "USD") {
  const selected = rows.filter((row) => row.currency === currency);
  const total = (type: string, paidOnly = false) => selected.filter((row) => row.type === type && (!paidOnly || row.paid)).reduce((sum, row) => sum + row.amountCents, 0);
  const revenue = total("REVENUE");
  const expense = total("EXPENSE") + total("PURCHASE");
  return { revenue, expense, balance: revenue - expense, cashBalance: total("REVENUE", true) - total("EXPENSE", true) - total("PURCHASE", true), credits: total("CREDIT") };
}
