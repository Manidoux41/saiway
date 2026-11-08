const dayMs = 86_400_000;
export function payrollPeriod(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0, 4)) < 1900) throw new Error("Invalid payroll month");
  const [year, number] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, number - 1, 1) - 7 * 3_600_000);
  const end = new Date(Date.UTC(year, number, 1) - 7 * 3_600_000);
  return { start, end, days: Math.round((end.getTime() - start.getTime()) / dayMs), scheduledPayAt: new Date(Date.UTC(year, number, 26) - 7 * 3_600_000) };
}
export function proratedSalary(month: string, contracts: Array<{ startsAt: Date; terminatedAt: Date | null; monthlySalaryCents: number }>) {
  const { days } = payrollPeriod(month);
  let total = 0;
  const parts: Array<{ employedDays: number; salaryCents: number; proratedCents: number }> = [];
  const occupied = new Set<number>();
  for (const contract of contracts) {
    const start = contract.startsAt.toISOString().slice(0, 10);
    const end = contract.terminatedAt?.toISOString().slice(0, 10);
    let employedDays = 0;
    for (let day = 1; day <= days; day++) {
      const current = `${month}-${String(day).padStart(2, "0")}`;
      if (current >= start && (!end || current <= end)) {
        if (occupied.has(day)) throw new Error("Overlapping salary contracts");
        occupied.add(day); employedDays++;
      }
    }
    const proratedCents = Math.round(contract.monthlySalaryCents * employedDays / days);
    total += proratedCents;
    parts.push({ employedDays, salaryCents: contract.monthlySalaryCents, proratedCents });
  }
  return { total, parts };
}
export function payrollAmounts(base: number, revenue: number, bonus: number, deduction: number) {
  const commission = Math.round(revenue * 8000 / 10000);
  const gross = base + commission + bonus;
  const net = gross - deduction;
  if (![base, revenue, bonus, deduction, commission, gross, net].every((value) => Number.isSafeInteger(value) && value >= 0 && value <= 2_147_483_647)) throw new Error("Invalid payroll amounts");
  return { commission, net };
}
