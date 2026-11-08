import "server-only";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { isDeepStrictEqual } from "node:util";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { readEmployer } from "@/lib/employer";
import { payrollAmounts, payrollPeriod, proratedSalary } from "@/lib/payroll-policy";

const noStore = { "Cache-Control": "no-store" };
const monthSchema = z.string().regex(/^(19|20|21)\d{2}-(0[1-9]|1[0-2])$/);
const amount = z.number().int().nonnegative().max(100_000_000);
const draftSchema = z.object({ driverId: z.string().min(1), month: monthSchema, bonusCents: amount.default(0), deductionCents: amount.default(0), adjustmentNotes: z.string().trim().max(2000).nullable().optional() }).strict().refine((value) => !(value.bonusCents || value.deductionCents) || Boolean(value.adjustmentNotes), "Adjustment notes required");
const actionSchema = z.discriminatedUnion("action", [
  z.object({ id: z.string().min(1), action: z.literal("FINALIZE"), expectedUpdatedAt: z.iso.datetime() }).strict(),
  z.object({ id: z.string().min(1), action: z.literal("PAID"), paidAt: z.iso.datetime({ offset: true }) }).strict(),
]);
class PayrollError extends Error { constructor(message: string, readonly status = 409) { super(message); } }
export function payrollFailure(error: unknown) {
  if (error instanceof PayrollError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid payroll values" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "Payroll or driver not found" }, { status: 404 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return Response.json({ error: "Concurrent payroll change; reload and review" }, { status: 409 });
  console.error("Payroll request failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "Payroll service unavailable" }, { status: 503 });
}

async function calculate(tx: Prisma.TransactionClient, input: z.infer<typeof draftSchema>, cutoff = new Date()) {
  const period = payrollPeriod(input.month);
  const driver = await tx.driverProfile.findUniqueOrThrow({ where: { id: input.driverId }, include: { user: { select: { name: true } }, employmentContracts: { where: { status: { in: ["ACTIVE", "TERMINATED"] } }, orderBy: { startsAt: "asc" } } } });
  const lastDay = `${input.month}-${String(period.days).padStart(2, "0")}`;
  const contracts = driver.employmentContracts.filter((contract) => contract.startsAt.toISOString().slice(0, 10) <= lastDay)
    .filter((contract) => !contract.terminatedAt || contract.terminatedAt.toISOString().slice(0, 10) >= `${input.month}-01`);
  if (!contracts.length || contracts.some((contract) => contract.currency !== "USD")) throw new PayrollError("Eligible USD salary contract required");
  let salary;
  try { salary = proratedSalary(input.month, contracts); } catch { throw new PayrollError("Overlapping salary contracts require review"); }
  const candidates = await tx.booking.findMany({ where: { driverId: driver.id, status: "TRIP_COMPLETED" }, orderBy: { id: "asc" }, select: { id: true, reference: true, currency: true, priceCents: true, completedAt: true, statusHistory: { where: { status: "TRIP_COMPLETED" }, orderBy: { createdAt: "asc" }, take: 1 }, payments: { where: { status: "PAID", provider: { not: "ABA_PAYWAY_SANDBOX" } }, orderBy: { id: "asc" } } } });
  const sources: Array<{ bookingId: string; reference: string; completedAt: string; amountCents: number; payments: Array<{ id: string; amountCents: number; confirmedAt: string; historicalDate: boolean }> }> = [];
  const priorPayrolls = await tx.payroll.findMany({ where: { status: { in: ["FINALIZED", "PAID"] }, NOT: { driverId: input.driverId, month: input.month } }, select: { snapshot: true } });
  const priorSources = z.object({ sources: z.array(z.object({ payments: z.array(z.object({ id: z.string() })) })) });
  const commissioned = new Set(priorPayrolls.flatMap((payroll) => priorSources.parse(payroll.snapshot).sources.flatMap((source) => source.payments.map((payment) => payment.id))));
  let eligibleRevenueCents = 0;
  let unpaidTrips = 0;
  let undatedTrips = 0;
  for (const booking of candidates) {
    const completed = booking.completedAt ?? booking.statusHistory[0]?.createdAt;
    if (!completed) { undatedTrips++; continue; }
    if (completed < period.start || completed >= period.end) continue;
    const completionDay = new Date(completed.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
    if (!contracts.some((contract) => completionDay >= contract.startsAt.toISOString().slice(0, 10) && (!contract.terminatedAt || completionDay <= contract.terminatedAt.toISOString().slice(0, 10)))) continue;
    const payments = booking.payments.filter((payment) => (payment.confirmedAt ?? payment.updatedAt) <= cutoff);
    if (!payments.length) { unpaidTrips++; continue; }
    if (payments.some((payment) => commissioned.has(payment.id))) throw new PayrollError("Trip receipts already included in another finalized payroll");
    if (booking.currency !== "USD" || payments.some((payment) => payment.currency !== "USD")) throw new PayrollError("Non-USD trip receipts require review");
    const collected = payments.reduce((sum, payment) => sum + payment.amountCents, 0);
    if (collected > booking.priceCents) throw new PayrollError("Duplicate or excessive trip receipts require review");
    eligibleRevenueCents += collected;
    sources.push({ bookingId: booking.id, reference: booking.reference, completedAt: completed.toISOString(), amountCents: collected, payments: payments.map((payment) => ({ id: payment.id, amountCents: payment.amountCents, confirmedAt: (payment.confirmedAt ?? payment.updatedAt).toISOString(), historicalDate: payment.confirmedAt === null })) });
  }
  let totals;
  try { totals = payrollAmounts(salary.total, eligibleRevenueCents, input.bonusCents, input.deductionCents); } catch { throw new PayrollError("Deductions exceed pay or payroll amount is invalid", 400); }
  const employer = await readEmployer(tx);
  return {
    baseSalaryCents: salary.total, eligibleRevenueCents, commissionCents: totals.commission, commissionBps: 8000,
    bonusCents: input.bonusCents, deductionCents: input.deductionCents, netCents: totals.net,
    adjustmentNotes: input.adjustmentNotes ?? null, scheduledPayAt: period.scheduledPayAt,
    snapshot: { version: 1, employeeName: driver.user.name, employer, month: input.month, periodStart: period.start.toISOString(), periodEnd: period.end.toISOString(), cutoff: cutoff.toISOString(), commissionBps: 8000, contracts: contracts.map((contract, index) => ({ id: contract.id, reference: contract.reference, startsAt: contract.startsAt.toISOString(), terminatedAt: contract.terminatedAt?.toISOString() ?? null, ...salary.parts[index] })), sources, unpaidTrips, undatedTrips, baseSalaryCents: salary.total, eligibleRevenueCents, commissionCents: totals.commission, bonusCents: input.bonusCents, deductionCents: input.deductionCents, netCents: totals.net, adjustmentNotes: input.adjustmentNotes ?? null },
  };
}

export async function payrollRequest(request: Request, role: "ADMIN" | "DRIVER") {
  try {
    const account = await authorize(request, role);
    if (!account) throw new PayrollError(`${role} access required`, 403);
    if (role === "DRIVER") {
      const payrolls = await prisma.payroll.findMany({ where: { driver: { userId: account.id }, status: { in: ["FINALIZED", "PAID"] } }, orderBy: { month: "desc" } });
      return Response.json({ payrolls }, { headers: noStore });
    }
    if (request.method === "GET") {
      const month = monthSchema.parse(new URL(request.url).searchParams.get("month"));
      const [payrolls, drivers] = await Promise.all([
        prisma.payroll.findMany({ where: { month }, include: { driver: { select: { user: { select: { name: true } } } } }, orderBy: { createdAt: "asc" } }),
        prisma.driverProfile.findMany({ where: { employmentContracts: { some: { status: { in: ["ACTIVE", "TERMINATED"] } } } }, select: { id: true, user: { select: { name: true } } }, orderBy: { createdAt: "asc" } }),
      ]);
      return Response.json({ payrolls, drivers }, { headers: noStore });
    }
    const command = request.method === "POST" ? draftSchema.parse(await request.json()) : actionSchema.parse(await request.json());
    const payroll = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(711080580)`;
      const existing = "driverId" in command
        ? await tx.payroll.findUnique({ where: { driverId_month: { driverId: command.driverId, month: command.month } } })
        : await tx.payroll.findUniqueOrThrow({ where: { id: command.id } });
      const driverId = "driverId" in command ? command.driverId : existing!.driverId;
      await tx.$queryRaw`SELECT "id" FROM "DriverProfile" WHERE "id" = ${driverId} FOR UPDATE`;
      const current = existing ? await tx.payroll.findUniqueOrThrow({ where: { id: existing.id } }) : await tx.payroll.findUnique({ where: { driverId_month: { driverId, month: "month" in command ? command.month : existing!.month } } });
      if ("driverId" in command) {
        if (current && current.status !== "DRAFT") throw new PayrollError("Finalized payroll is immutable");
        const value = await calculate(tx, command);
        const saved = current ? await tx.payroll.update({ where: { id: current.id }, data: value }) : await tx.payroll.create({ data: { driverId, month: command.month, ...value } });
        await tx.auditLog.create({ data: { actorId: account.id, entity: "Payroll", entityId: saved.id, action: "DRAFT", metadata: { month: saved.month } } });
        return saved;
      }
      if (!current) throw new PayrollError("Payroll not found", 404);
      if (command.action === "FINALIZE") {
        if (current.status !== "DRAFT") return current;
        if (current.updatedAt.toISOString() !== command.expectedUpdatedAt) throw new PayrollError("Payroll draft changed; reload and review");
        if (payrollPeriod(current.month).end > new Date()) throw new PayrollError("Only a closed calendar month can be finalized");
        const value = await calculate(tx, { driverId, month: current.month, bonusCents: current.bonusCents, deductionCents: current.deductionCents, adjustmentNotes: current.adjustmentNotes });
        const reviewed = z.record(z.string(), z.unknown()).parse(current.snapshot);
        const latest = z.record(z.string(), z.unknown()).parse(value.snapshot);
        delete reviewed.cutoff; delete latest.cutoff;
        if (!isDeepStrictEqual(reviewed, latest)) throw new PayrollError("Payroll sources changed; recalculate draft and review before finalizing");
        const updated = await tx.payroll.update({ where: { id: current.id }, data: { ...value, status: "FINALIZED", finalizedAt: new Date() } });
        await tx.auditLog.create({ data: { actorId: account.id, entity: "Payroll", entityId: current.id, action: "FINALIZE", metadata: { netCents: updated.netCents } } });
        return updated;
      }
      if (current.status === "DRAFT") throw new PayrollError("Finalize payroll before marking it paid");
      const paidAt = new Date(command.paidAt);
      if (current.status === "PAID") {
        if (current.paidAt?.getTime() !== paidAt.getTime()) throw new PayrollError("Payroll is already paid on another date");
        return current;
      }
      if (paidAt > new Date() || paidAt < payrollPeriod(current.month).end) throw new PayrollError("Invalid actual payroll payment date", 400);
      const sourceKey = `payroll:${current.id}`;
      await tx.accountingEntry.create({ data: { sourceKey, type: "EXPENSE", category: "SALARY", label: `Payroll ${current.month}`, amountCents: current.netCents, currency: "USD", entryDate: paidAt, paidAt, notes: current.adjustmentNotes } });
      const updated = await tx.payroll.update({ where: { id: current.id }, data: { status: "PAID", paidAt } });
      await tx.auditLog.create({ data: { actorId: account.id, entity: "Payroll", entityId: current.id, action: "PAID", metadata: { sourceKey, netCents: current.netCents, paidAt: paidAt.toISOString() } } });
      return updated;
    }, { timeout: 20_000 });
    return Response.json({ payroll }, { headers: noStore, status: request.method === "POST" ? 201 : 200 });
  } catch (error) { return payrollFailure(error); }
}
