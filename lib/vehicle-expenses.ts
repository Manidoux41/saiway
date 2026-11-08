import "server-only";

import { AccountingCategory, Prisma, VehicleExpenseStatus } from "@prisma/client";
import { z } from "zod";
import { authorize } from "@/lib/access";
import { inServiceStatuses } from "@/lib/dispatch-policy";
import { prisma } from "@/lib/prisma";
import { convertedUsdCents, fixedDecimal, formatFixedDecimal, odometerOrderConflict, parseOccurredAt } from "@/lib/vehicle-expense-policy";

export class VehicleExpenseError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
  }
}

const noCacheHeaders = { "Cache-Control": "no-store" };
const maxOdometer = BigInt(999_999_999_999);
const maxLiters = BigInt(9_999_999_999);
const maxRate = BigInt(999_999_999_999);
const databaseIntegerMax = 2_147_483_647;

const fuelCommand = z.object({
  requestId: z.uuid(),
  vehicleId: z.string().min(1).max(64),
  occurredAt: z.string().min(1).max(40),
  odometerKm: z.string().min(1).max(20),
  liters: z.string().min(1).max(20),
  amountCents: z.number().int().safe().positive().max(databaseIntegerMax),
  currency: z.enum(["USD", "KHR"]),
  khrPerUsd: z.string().max(24).nullable().optional(),
  fullTank: z.boolean(),
  notes: z.string().max(500).nullable().optional(),
}).strict();

const maintenanceCommand = z.object({
  requestId: z.uuid(),
  vehicleId: z.string().min(1).max(64),
  occurredAt: z.string().min(1).max(40),
  odometerKm: z.string().min(1).max(20),
  amountCents: z.number().int().safe().positive().max(databaseIntegerMax),
  currency: z.enum(["USD", "KHR"]),
  khrPerUsd: z.string().max(24).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
}).strict();

const reviewCommand = z.object({
  id: z.string().min(1).max(64),
  action: z.enum(["APPROVE", "REJECT"]),
  reason: z.string().max(500).optional(),
}).strict();

const assignedStatuses = ["DRIVER_ASSIGNED", "DRIVER_ACCEPTED", ...inServiceStatuses] as const;
const expenseInclude = {
  vehicle: { select: { id: true, name: true, plate: true, active: true } },
  driver: { select: { id: true, user: { select: { name: true } } } },
} satisfies Prisma.VehicleExpenseInclude;
type ExpenseWithRelations = Prisma.VehicleExpenseGetPayload<{ include: typeof expenseInclude }>;

type ExpenseDraft = {
  requestId: string;
  vehicleId: string;
  driverId: string | null;
  category: AccountingCategory;
  occurredAt: Date;
  odometerKm: Prisma.Decimal;
  liters: Prisma.Decimal | null;
  amountCents: number;
  currency: "USD" | "KHR";
  khrPerUsd: Prisma.Decimal | null;
  usdCents: number;
  fullTank: boolean;
  notes: string | null;
};

function failureResponse(error: unknown, label: string) {
  if (error instanceof VehicleExpenseError) {
    return Response.json({ error: error.code }, { status: error.status, headers: noCacheHeaders });
  }
  if (error instanceof SyntaxError || error instanceof z.ZodError) {
    return Response.json({ error: "INVALID_REQUEST" }, { status: 400, headers: noCacheHeaders });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2034") return Response.json({ error: "CONCURRENT_CHANGE" }, { status: 409, headers: noCacheHeaders });
    if (error.code === "P2003" || error.code === "P2025") return Response.json({ error: "RECORD_NOT_FOUND" }, { status: 404, headers: noCacheHeaders });
  }
  console.error(`${label} failed`, { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
  return Response.json({ error: "SERVICE_UNAVAILABLE" }, { status: 503, headers: noCacheHeaders });
}

export function vehicleExpenseFailure(error: unknown, label: string) {
  return failureResponse(error, label);
}

function parseDraft(
  input: z.infer<typeof fuelCommand> | z.infer<typeof maintenanceCommand>,
  category: AccountingCategory,
  driverId: string | null,
): ExpenseDraft {
  const occurredAt = parseOccurredAt(input.occurredAt);
  if (!occurredAt || occurredAt.getTime() > Date.now()) throw new VehicleExpenseError("INVALID_DATE", 400);
  const odometerScaled = fixedDecimal(input.odometerKm, 1, maxOdometer, false);
  if (odometerScaled === null) throw new VehicleExpenseError("INVALID_ODOMETER", 400);
  const litersText = "liters" in input ? input.liters : null;
  const litersScaled = litersText === null ? null : fixedDecimal(litersText, 3, maxLiters, true);
  if (litersText !== null && litersScaled === null) throw new VehicleExpenseError("INVALID_LITERS", 400);

  const rateText = input.khrPerUsd ?? null;
  const usdCents = convertedUsdCents(input.amountCents, input.currency, rateText);
  if (usdCents === null) throw new VehicleExpenseError("INVALID_AMOUNT_OR_RATE", 400);
  const rateScaled = rateText === null ? null : fixedDecimal(rateText, 4, maxRate, true);
  if (input.currency === "KHR" && rateScaled === null) throw new VehicleExpenseError("INVALID_AMOUNT_OR_RATE", 400);

  return {
    requestId: input.requestId,
    vehicleId: input.vehicleId,
    driverId,
    category,
    occurredAt,
    odometerKm: new Prisma.Decimal(formatFixedDecimal(odometerScaled, 1)),
    liters: litersScaled === null ? null : new Prisma.Decimal(formatFixedDecimal(litersScaled, 3)),
    amountCents: input.amountCents,
    currency: input.currency,
    khrPerUsd: rateScaled === null ? null : new Prisma.Decimal(formatFixedDecimal(rateScaled, 4)),
    usdCents,
    fullTank: "fullTank" in input ? input.fullTank : false,
    notes: input.notes?.trim() || null,
  };
}

function expenseView(expense: ExpenseWithRelations) {
  return {
    id: expense.id,
    requestId: expense.requestId,
    vehicleId: expense.vehicleId,
    category: expense.category,
    occurredAt: expense.occurredAt.toISOString(),
    odometerKm: expense.odometerKm.toString(),
    liters: expense.liters?.toString() ?? null,
    amountCents: expense.amountCents,
    currency: expense.currency as "USD" | "KHR",
    khrPerUsd: expense.khrPerUsd?.toString() ?? null,
    usdCents: expense.usdCents,
    fullTank: expense.fullTank,
    notes: expense.notes,
    status: expense.status,
    reviewedAt: expense.reviewedAt?.toISOString() ?? null,
    reviewedBy: expense.reviewedBy,
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
    vehicle: expense.vehicle,
    driver: expense.driver ? { id: expense.driver.id, name: expense.driver.user.name } : null,
  };
}

function sameDraft(expense: ExpenseWithRelations, draft: ExpenseDraft) {
  return expense.requestId === draft.requestId
    && expense.driverId === draft.driverId
    && expense.vehicleId === draft.vehicleId
    && expense.category === draft.category
    && expense.occurredAt.getTime() === draft.occurredAt.getTime()
    && expense.odometerKm.equals(draft.odometerKm)
    && (expense.liters === null ? draft.liters === null : draft.liters !== null && expense.liters.equals(draft.liters))
    && expense.amountCents === draft.amountCents
    && expense.currency === draft.currency
    && (expense.khrPerUsd === null ? draft.khrPerUsd === null : draft.khrPerUsd !== null && expense.khrPerUsd.equals(draft.khrPerUsd))
    && expense.usdCents === draft.usdCents
    && expense.fullTank === draft.fullTank
    && expense.notes === draft.notes;
}

async function findIdempotent(requestId: string, draft: ExpenseDraft) {
  const existing = await prisma.vehicleExpense.findUnique({ where: { requestId }, include: expenseInclude });
  if (!existing) return null;
  if (!sameDraft(existing, draft)) throw new VehicleExpenseError("IDEMPOTENCY_CONFLICT", 409);
  return expenseView(existing);
}

async function lockVehicle(tx: Prisma.TransactionClient, vehicleId: string) {
  const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "Vehicle" WHERE "id" = ${vehicleId} FOR UPDATE`);
  if (!locked.length) throw new VehicleExpenseError("VEHICLE_NOT_FOUND", 404);
  if (!await tx.vehicle.count({ where: { id: vehicleId, active: true } })) throw new VehicleExpenseError("VEHICLE_NOT_AUTHORIZED", 409);
}

async function assertDriverVehicle(tx: Prisma.TransactionClient, driverId: string, vehicleId: string) {
  await tx.$queryRaw(Prisma.sql`SELECT "id" FROM "DriverProfile" WHERE "id" = ${driverId} FOR UPDATE`);
  const driver = await tx.driverProfile.findUnique({ where: { id: driverId }, select: { selectedVehicleId: true } });
  if (!driver) throw new VehicleExpenseError("DRIVER_NOT_FOUND", 404);
  if (driver.selectedVehicleId === vehicleId) return;
  const assigned = await tx.booking.count({
    where: { driverId, vehicleId, status: { in: [...assignedStatuses] } },
  });
  if (!assigned) throw new VehicleExpenseError("VEHICLE_NOT_AUTHORIZED", 403);
}

async function assertOdometerOrder(tx: Prisma.TransactionClient, draft: ExpenseDraft) {
  const rows = await tx.vehicleExpense.findMany({
    where: { vehicleId: draft.vehicleId, status: { in: [VehicleExpenseStatus.PENDING, VehicleExpenseStatus.APPROVED] } },
    select: { occurredAt: true, odometerKm: true },
  });
  const conflict = odometerOrderConflict(
    rows.map((row) => ({ occurredAt: row.occurredAt, odometerKm: row.odometerKm.toString() })),
    { occurredAt: draft.occurredAt, odometerKm: draft.odometerKm.toString() },
  );
  if (conflict) throw new VehicleExpenseError("ODOMETER_ORDER_CONFLICT", 409);
}

async function createDraft(draft: ExpenseDraft, actorId: string) {
  const existing = await findIdempotent(draft.requestId, draft);
  if (existing) return { expense: existing, duplicate: true };
  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockVehicle(tx, draft.vehicleId);
      if (draft.driverId) await assertDriverVehicle(tx, draft.driverId, draft.vehicleId);
      const racedRequest = await tx.vehicleExpense.findUnique({ where: { requestId: draft.requestId }, include: expenseInclude });
      if (racedRequest) {
        if (!sameDraft(racedRequest, draft)) throw new VehicleExpenseError("IDEMPOTENCY_CONFLICT", 409);
        return { expense: racedRequest, duplicate: true };
      }
      await assertOdometerOrder(tx, draft);
      const created = await tx.vehicleExpense.create({ data: draft, include: expenseInclude });
      await tx.auditLog.create({
        data: {
          actorId,
          entity: "VehicleExpense",
          entityId: created.id,
          action: "SUBMIT",
          metadata: { requestId: created.requestId, vehicleId: created.vehicleId, category: created.category },
        },
      });
      return { expense: created, duplicate: false };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    return { expense: expenseView(result.expense), duplicate: result.duplicate };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const raced = await findIdempotent(draft.requestId, draft);
      if (raced) return { expense: raced, duplicate: true };
    }
    throw error;
  }
}

async function parseRequestBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new VehicleExpenseError("INVALID_REQUEST", 400);
  }
}

export async function listDriverVehicleExpenses(request: Request) {
  const account = await authorize(request, "DRIVER");
  if (!account) throw new VehicleExpenseError("DRIVER_ACCESS_REQUIRED", 403);
  const driver = await prisma.driverProfile.findUnique({ where: { userId: account.id }, select: { id: true, selectedVehicleId: true } });
  if (!driver) throw new VehicleExpenseError("DRIVER_NOT_FOUND", 404);
  const assignments = await prisma.booking.findMany({
    where: { driverId: driver.id, status: { in: [...assignedStatuses] } },
    select: { vehicleId: true },
    distinct: ["vehicleId"],
  });
  const vehicleIds = [...new Set([driver.selectedVehicleId, ...assignments.map((item) => item.vehicleId)].filter((id): id is string => id !== null))];
  const [vehicles, expenses] = await Promise.all([
    vehicleIds.length ? prisma.vehicle.findMany({
      where: { id: { in: vehicleIds } },
      select: { id: true, name: true, plate: true, active: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }) : Promise.resolve([]),
    prisma.vehicleExpense.findMany({
      where: { driverId: driver.id, category: AccountingCategory.FUEL },
      include: expenseInclude,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);
  return { vehicles, expenses: expenses.map(expenseView) };
}

export async function submitDriverFuelExpense(request: Request) {
  const account = await authorize(request, "DRIVER");
  if (!account) throw new VehicleExpenseError("DRIVER_ACCESS_REQUIRED", 403);
  const driver = await prisma.driverProfile.findUnique({ where: { userId: account.id }, select: { id: true } });
  if (!driver) throw new VehicleExpenseError("DRIVER_NOT_FOUND", 404);
  const parsed = fuelCommand.safeParse(await parseRequestBody(request));
  if (!parsed.success) throw new VehicleExpenseError("INVALID_REQUEST", 400);
  const draft = parseDraft(parsed.data, AccountingCategory.FUEL, driver.id);
  const result = await createDraft(draft, account.id);
  return { expense: result.expense, duplicate: result.duplicate };
}

async function listAdminExpenses() {
  const [pending, recent, vehicles] = await Promise.all([
    prisma.vehicleExpense.findMany({
      where: { status: VehicleExpenseStatus.PENDING },
      include: expenseInclude,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    }),
    prisma.vehicleExpense.findMany({
      where: { status: { in: [VehicleExpenseStatus.APPROVED, VehicleExpenseStatus.REJECTED] } },
      include: expenseInclude,
      orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.vehicle.findMany({
      select: { id: true, name: true, plate: true, active: true },
      orderBy: [{ active: "desc" }, { name: "asc" }, { id: "asc" }],
    }),
  ]);
  return { vehicles, expenses: [...pending, ...recent].map(expenseView) };
}

export async function getAdminVehicleExpenses(request: Request) {
  if (!await authorize(request, "ADMIN")) throw new VehicleExpenseError("ADMIN_ACCESS_REQUIRED", 403);
  return listAdminExpenses();
}

export async function submitAdminMaintenanceExpense(request: Request) {
  const account = await authorize(request, "ADMIN");
  if (!account) throw new VehicleExpenseError("ADMIN_ACCESS_REQUIRED", 403);
  const parsed = maintenanceCommand.safeParse(await parseRequestBody(request));
  if (!parsed.success) throw new VehicleExpenseError("INVALID_REQUEST", 400);
  const draft = parseDraft(parsed.data, AccountingCategory.MAINTENANCE, null);
  const result = await createDraft(draft, account.id);
  return { expense: result.expense, duplicate: result.duplicate };
}

function ledgerEntryMatches(entry: {
  type: string;
  amountCents: number;
  currency: string;
  category: AccountingCategory;
  entryDate: Date;
  paidAt: Date | null;
  vehicleId: string | null;
  sourceKey: string | null;
}, expense: ExpenseWithRelations) {
  return entry.type === "EXPENSE"
    && entry.amountCents === expense.usdCents
    && entry.currency === "USD"
    && entry.category === expense.category
    && entry.entryDate.getTime() === expense.occurredAt.getTime()
    && entry.paidAt?.getTime() === expense.occurredAt.getTime()
    && entry.vehicleId === expense.vehicleId
    && entry.sourceKey === `vehicle-expense:${expense.id}`;
}

async function reviewExpense(input: z.infer<typeof reviewCommand>, accountId: string) {
  if (input.action === "REJECT" && !input.reason?.trim()) throw new VehicleExpenseError("REJECTION_REASON_REQUIRED", 400);
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`SELECT "id" FROM "VehicleExpense" WHERE "id" = ${input.id} FOR UPDATE`);
    if (!locked.length) throw new VehicleExpenseError("EXPENSE_NOT_FOUND", 404);
    const expense = await tx.vehicleExpense.findUnique({ where: { id: input.id }, include: expenseInclude });
    if (!expense) throw new VehicleExpenseError("EXPENSE_NOT_FOUND", 404);
    if (input.action === "APPROVE") {
      if (expense.status === VehicleExpenseStatus.REJECTED) throw new VehicleExpenseError("EXPENSE_ALREADY_REJECTED", 409);
      const sourceKey = `vehicle-expense:${expense.id}`;
      const existingEntry = await tx.accountingEntry.findUnique({ where: { sourceKey } });
      if (expense.status === VehicleExpenseStatus.APPROVED) {
        if (!existingEntry || !ledgerEntryMatches(existingEntry, expense)) throw new VehicleExpenseError("LEDGER_ENTRY_INCONSISTENT", 409);
        return { expense: expenseView(expense), duplicate: true };
      }
      if (existingEntry && !ledgerEntryMatches(existingEntry, expense)) throw new VehicleExpenseError("LEDGER_ENTRY_CONFLICT", 409);
      if (!existingEntry) {
        const currencyNote = expense.currency === "KHR"
          ? `Original payment: ${expense.amountCents} KHR at ${expense.khrPerUsd?.toString() ?? "?"} KHR/USD.`
          : null;
        const notes = [currencyNote, expense.notes].filter(Boolean).join(" ");
        await tx.accountingEntry.create({
          data: {
            type: "EXPENSE",
            label: `${expense.category === AccountingCategory.FUEL ? "Fuel" : "Maintenance"} — ${expense.vehicle.plate}`,
            amountCents: expense.usdCents,
            currency: "USD",
            paidAt: expense.occurredAt,
            entryDate: expense.occurredAt,
            category: expense.category,
            sourceKey,
            vehicleId: expense.vehicleId,
            notes: notes || null,
          },
        });
      }
      const reviewedAt = new Date();
      const updated = await tx.vehicleExpense.update({
        where: { id: expense.id },
        data: { status: VehicleExpenseStatus.APPROVED, reviewedAt, reviewedBy: accountId },
        include: expenseInclude,
      });
      await tx.auditLog.create({
        data: {
          actorId: accountId,
          entity: "VehicleExpense",
          entityId: expense.id,
          action: "APPROVE",
          metadata: { sourceKey, usdCents: expense.usdCents, category: expense.category },
        },
      });
      return { expense: expenseView(updated), duplicate: false };
    }
    if (expense.status === VehicleExpenseStatus.APPROVED) throw new VehicleExpenseError("APPROVED_EXPENSE_IMMUTABLE", 409);
    if (expense.status === VehicleExpenseStatus.REJECTED) return { expense: expenseView(expense), duplicate: true };
    const updated = await tx.vehicleExpense.update({
      where: { id: expense.id },
      data: { status: VehicleExpenseStatus.REJECTED, reviewedAt: new Date(), reviewedBy: accountId },
      include: expenseInclude,
    });
    await tx.auditLog.create({
      data: {
        actorId: accountId,
        entity: "VehicleExpense",
        entityId: expense.id,
        action: "REJECT",
        metadata: { reason: input.reason?.trim() ?? "", category: expense.category, usdCents: expense.usdCents },
      },
    });
    return { expense: expenseView(updated), duplicate: false };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}

export async function reviewAdminVehicleExpense(request: Request) {
  const account = await authorize(request, "ADMIN");
  if (!account) throw new VehicleExpenseError("ADMIN_ACCESS_REQUIRED", 403);
  const parsed = reviewCommand.safeParse(await parseRequestBody(request));
  if (!parsed.success) throw new VehicleExpenseError("INVALID_REQUEST", 400);
  return reviewExpense(parsed.data, account.id);
}

export function vehicleExpenseResponse<T>(action: () => Promise<T>, label: string, status = 200) {
  return async () => {
    try {
      const data = await action();
      return Response.json(data, { status, headers: noCacheHeaders });
    } catch (error) {
      return failureResponse(error, label);
    }
  };
}
