import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { DispatchError } from "@/lib/driver-dispatch";
import { recordPaymentRevenue } from "@/lib/payment-accounting";

const cents = z.number().int().nonnegative().max(100000000);
const date = z.iso.datetime({ offset: true }).transform((value) => new Date(value));
const text = z.string().trim().min(1).max(500);
const control = z.object({
  expectedUpdatedAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(1).max(2000),
});
const schemas = {
  accounting: z.object({
    type: z.enum(["REVENUE", "EXPENSE", "CREDIT", "PURCHASE"]), label: text,
    amountCents: cents, currency: z.literal("USD").optional(),
    entryDate: date.optional(), paidAt: date.nullable().optional(),
    category: z.enum(["TRIP", "FUEL", "MAINTENANCE", "SALARY", "OTHER"]).optional(),
    vehicleId: z.string().min(1).nullable().optional(), notes: z.string().max(2000).nullable().optional(),
  }),
  forecast: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).transform((value) => new Date(`${value}-01T00:00:00Z`)),
    expectedRevenueCents: cents, expectedExpenseCents: cents, notes: z.string().max(2000).nullable().optional(),
  }),
  contract: z.object({
    vehicleId: text, provider: text, monthlyCents: cents, startsAt: date,
    endsAt: date.nullable().optional(), status: z.enum(["ACTIVE", "INACTIVE"]),
    kind: z.enum(["RENTAL", "FINANCING"]).optional(),
  }),
};

function snapshot(value: object): Prisma.InputJsonObject {
  return JSON.parse(JSON.stringify(value));
}

export async function mutateFinance(tx: Prisma.TransactionClient, entity: keyof typeof schemas, id: string | undefined, data: Record<string, unknown>, actorId: string, method: string) {
  const creating = method === "POST";
  const removing = method === "DELETE";
  const controls = creating ? null : control.parse(data);
  let recordId = id;
  let materialized = false;
  if (!creating && entity === "accounting" && id?.startsWith("payment:")) {
    const payment = await tx.payment.findUniqueOrThrow({ where: { id: id.slice(8) } });
    if (payment.status !== "PAID" || payment.provider === "ABA_PAYWAY_SANDBOX") throw new DispatchError("Receipt is not eligible for accounting", 409);
    if (payment.updatedAt.getTime() !== Date.parse(controls!.expectedUpdatedAt)) throw new DispatchError("Financial entry changed; refresh and retry", 409);
    if (await tx.accountingEntry.count({ where: { sourceKey: id } })) throw new DispatchError("Financial entry changed; refresh and retry", 409);
    await recordPaymentRevenue(tx, payment);
    recordId = (await tx.accountingEntry.findUniqueOrThrow({ where: { sourceKey: id } })).id;
    materialized = true;
  }
  const existing = creating ? null
    : entity === "accounting" ? await tx.accountingEntry.findUniqueOrThrow({ where: { id: recordId } })
      : entity === "forecast" ? await tx.forecastLine.findUniqueOrThrow({ where: { id: recordId } })
        : await tx.vehicleContract.findUniqueOrThrow({ where: { id: recordId } });
  if (existing && (existing.deletedAt || !materialized && existing.updatedAt.getTime() !== Date.parse(controls!.expectedUpdatedAt))) throw new DispatchError("Financial entry changed; refresh and retry", 409);
  const values = { ...data };
  delete values.expectedUpdatedAt;
  delete values.reason;
  let result;
  if (entity === "accounting") {
    const before = !creating ? await tx.accountingEntry.findUniqueOrThrow({ where: { id: recordId } }) : null;
    const value = removing ? {} : (creating ? schemas.accounting.strict() : schemas.accounting.partial().strict()).parse(values);
    if (before?.sourceKey && (value.type !== undefined && value.type !== before.type || value.category !== undefined && value.category !== before.category || value.currency !== undefined && value.currency !== before.currency)) throw new DispatchError("Linked accounting source type and currency cannot change", 409);
    const category = value.category ?? before?.category;
    const type = value.type ?? before?.type;
    const vehicleId = value.vehicleId === undefined ? before?.vehicleId : value.vehicleId;
    if (!removing && (category === "FUEL" || category === "MAINTENANCE") && (type !== "EXPENSE" || !vehicleId)) throw new DispatchError("Vehicle costs require expense type and vehicle", 400);
    if (!removing && vehicleId && !await tx.vehicle.count({ where: { id: vehicleId } })) throw new DispatchError("Invalid vehicle", 400);
    result = before ? await tx.accountingEntry.update({
      where: { id: before.id, updatedAt: before.updatedAt, deletedAt: null },
      data: removing ? { deletedAt: new Date() } : value,
    }) : await tx.accountingEntry.create({ data: schemas.accounting.strict().parse(values) });
  } else if (entity === "forecast") {
    const value = removing ? {} : (creating ? schemas.forecast.strict() : schemas.forecast.partial().strict()).parse(values);
    result = existing ? await tx.forecastLine.update({
      where: { id: existing.id, updatedAt: existing.updatedAt, deletedAt: null },
      data: removing ? { deletedAt: new Date() } : value,
    }) : await tx.forecastLine.create({ data: schemas.forecast.strict().parse(values) });
  } else {
    const before = !creating ? await tx.vehicleContract.findUniqueOrThrow({ where: { id: recordId } }) : null;
    const value = removing ? {} : (creating ? schemas.contract.strict() : schemas.contract.partial().strict()).parse(values);
    const start = value.startsAt ?? before?.startsAt;
    const end = value.endsAt === undefined ? before?.endsAt : value.endsAt;
    if (!removing) {
      if (start && end && end < start) throw new DispatchError("Contract end must follow start", 400);
      if (!await tx.vehicle.count({ where: { id: value.vehicleId ?? before?.vehicleId } })) throw new DispatchError("Invalid vehicle", 400);
    }
    result = before ? await tx.vehicleContract.update({
      where: { id: before.id, updatedAt: before.updatedAt, deletedAt: null },
      data: removing ? { deletedAt: new Date(), status: "INACTIVE" } : value,
    }) : await tx.vehicleContract.create({ data: schemas.contract.strict().parse(values) });
  }
  await tx.auditLog.create({ data: {
    actorId, entity: entity === "accounting" ? "AccountingEntry" : entity === "forecast" ? "ForecastLine" : "VehicleContract",
    entityId: result.id, action: removing ? "DELETE" : creating ? "CREATE" : "CORRECT",
    metadata: { reason: controls?.reason ?? null, before: existing ? snapshot(existing) : null, after: snapshot(result) },
  } });
  return result;
}
