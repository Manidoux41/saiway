import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import { gpsRetentionEnabled, gpsRetentionSettingKey } from "@/lib/cron-settings";
import { farePolicy, farePolicyKey, farePolicySchema } from "@/lib/fare-policy";
import { activeFarePolicy } from "@/lib/fare-store";
import { DispatchError, dispatchTransaction } from "@/lib/driver-dispatch";
import { enqueueAvailabilityPush } from "@/lib/push-events";
import { schedulePushDelivery } from "@/lib/push-delivery";

export const runtime = "nodejs";

const name = z.string().trim().min(1).max(500);
const cents = z.number().int().nonnegative().max(100000000);
const date = z.coerce.date();
const fields = {
  user: z.object({ name, email: z.string().trim().toLowerCase().pipe(z.email()), status: z.enum(["ACTIVE", "SUSPENDED", "INVITED"]), phone: z.string().max(50).nullable().optional(), isAvailable: z.boolean().optional(), licenseNo: z.string().trim().max(100).nullable().optional(), licenseExpiresAt: z.union([z.literal("").transform(() => null), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value) => new Date(`${value}T00:00:00Z`))]).nullable().optional() }),
  vehicle: z.object({ name, plate: name, seats: z.coerce.number().int().min(1).max(50), active: z.boolean().optional(), iconCategory: z.enum(["TUK_TUK", "PASSAPP", "SEDAN", "SUV", "MINIVAN", "MINIBUS", "VAN", "OTHER"]).optional() }),
  hub: z.object({ name, address: z.string().trim().max(500).nullable().optional(), latitude: z.coerce.number().finite().min(-90).max(90), longitude: z.coerce.number().finite().min(-180).max(180), active: z.boolean().optional() }),
  accounting: z.object({ type: z.enum(["REVENUE", "EXPENSE", "CREDIT", "PURCHASE"]), label: name, amountCents: cents, currency: z.literal("USD").optional(), notes: z.string().max(2000).optional(), paidAt: date.nullable().optional() }),
  forecast: z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).transform((value) => new Date(`${value}-01T00:00:00Z`)), expectedRevenueCents: cents, expectedExpenseCents: cents, notes: z.string().max(2000).optional() }),
  pricing: z.object({ name, amountCents: cents, currency: z.literal("USD").optional(), direction: z.enum(["AIRPORT_TO_CITY", "CITY_TO_AIRPORT"]).nullable().optional(), tripType: z.enum(["AIRPORT_TRANSFER", "PRIVATE_TRANSFER", "HOTEL_TRANSFER"]).nullable().optional(), active: z.boolean().optional(), effectiveAt: date }),
  contract: z.object({ vehicleId: name, provider: name, monthlyCents: cents, startsAt: date, endsAt: date.nullable().optional(), status: z.enum(["ACTIVE", "INACTIVE"]) }),
  setting: z.discriminatedUnion("key", [
    z.object({ key: z.literal("heroBackground"), value: z.url().refine((value) => value.startsWith("https://"), "HTTPS image required") }).strict(),
    z.object({ key: z.literal(gpsRetentionSettingKey), value: z.boolean().transform(String) }).strict(),
    z.object({ key: z.literal(farePolicyKey), value: farePolicySchema.transform((value) => JSON.stringify(value)), effectiveAt: z.iso.datetime({ offset: true }).optional() }).strict(),
  ]),
};
const input = z.object({ entity: z.enum(["user", "vehicle", "hub", "accounting", "forecast", "pricing", "contract", "setting"]), id: z.string().optional(), data: z.record(z.string(), z.unknown()).optional() });

export async function GET(request: Request) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const [users, vehicles, hubs, entries, forecasts, contracts, pricing, settings, receipts] = await Promise.all([
      prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, status: true, phone: true, driver: { select: { id: true, isAvailable: true, licenseNo: true, licenseExpiresAt: true, licenseImages: { select: { side: true, sizeBytes: true, uploadedAt: true }, orderBy: { side: "asc" } }, photo: { select: { uploadedAt: true } }, contactQrImages: { select: { channel: true, uploadedAt: true }, orderBy: { channel: "asc" } } } } }, orderBy: { createdAt: "desc" } }),
      prisma.vehicle.findMany({ include: { iconImage: { select: { uploadedAt: true, sizeBytes: true } } }, orderBy: { createdAt: "desc" } }),
      prisma.hub.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
      prisma.accountingEntry.findMany({ orderBy: { createdAt: "desc" } }),
      prisma.forecastLine.findMany({ orderBy: { month: "asc" } }),
      prisma.vehicleContract.findMany({ include: { vehicle: { select: { name: true, plate: true } } }, orderBy: { startsAt: "desc" } }),
      prisma.pricingRule.findMany({ where: { policy: { equals: Prisma.DbNull } }, orderBy: { effectiveAt: "desc" } }),
      prisma.systemSetting.findMany({ where: { key: { in: ["heroBackground", gpsRetentionSettingKey, farePolicyKey] } } }),
      prisma.payment.findMany({
        where: { status: "PAID", provider: { not: "ABA_PAYWAY_SANDBOX" } },
        select: { id: true, amountCents: true, currency: true, provider: true, collectionMethod: true, updatedAt: true, booking: { select: { reference: true, status: true, driver: { select: { user: { select: { name: true } } } } } } },
        orderBy: { updatedAt: "desc" },
      }),
    ]);
    const retentionEnabled = gpsRetentionEnabled(settings.find((setting) => setting.key === gpsRetentionSettingKey)?.value);
    const [active, tariffHistory] = await Promise.all([activeFarePolicy(), prisma.pricingRule.findMany({ where: { policy: { not: Prisma.DbNull } }, orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }], take: 100, select: { id: true, effectiveAt: true, createdAt: true, policy: true } })]);
    return Response.json({ users, vehicles, hubs: hubs.map((hub) => ({ ...hub, latitude: Number(hub.latitude), longitude: Number(hub.longitude) })), entries, forecasts, contracts, pricing, settings, receipts, farePolicy: active.policy, tariffHistory, cron: { gpsRetentionEnabled: retentionEnabled, configured: Boolean(process.env.CRON_SECRET) } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

async function mutate(request: Request) {
  try {
    const actor = await authorize(request, "ADMIN");
    if (!actor) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid management request" }, { status: 400 });
    const { entity, id, data = {} } = parsed.data;
    const updating = request.method === "PATCH";
    const removing = request.method === "DELETE";
    if ((updating || removing) && !id) return Response.json({ error: "Missing record id" }, { status: 400 });
    if ((updating || removing) && entity === "user" && id === actor.id) return Response.json({ error: "An administrator cannot modify or suspend their own account here" }, { status: 409 });
    if (removing && !["user", "vehicle", "hub", "pricing", "contract"].includes(entity)) return Response.json({ error: "Financial history cannot be deleted. Edit the record instead." }, { status: 409 });
    if (!updating && !removing && entity === "user") return Response.json({ error: "Use account creation" }, { status: 400 });
    const item = await dispatchTransaction(async (tx) => {
      let result;
      if (removing) {
        if (entity === "user") result = await tx.user.update({ where: { id }, data: { status: "SUSPENDED" } });
        if (entity === "vehicle") result = await tx.vehicle.update({ where: { id }, data: { active: false } });
        if (entity === "hub") result = await tx.hub.update({ where: { id }, data: { active: false } });
        if (entity === "pricing") {
          if ((await tx.pricingRule.findUniqueOrThrow({ where: { id } })).policy !== null) throw new z.ZodError([{ code: "custom", path: ["id"], message: "Tariff history is immutable" }]);
          result = await tx.pricingRule.update({ where: { id }, data: { active: false } });
        }
        if (entity === "contract") result = await tx.vehicleContract.update({ where: { id }, data: { status: "INACTIVE" } });
      } else {
        if (entity === "user") {
          const { isAvailable, licenseNo, licenseExpiresAt, ...value } = fields.user.partial().strict().parse(data);
          const existing = await tx.user.findUniqueOrThrow({ where: { id }, include: { driver: true } });
          const driverFields = isAvailable !== undefined || licenseNo !== undefined || licenseExpiresAt !== undefined;
          if (driverFields && existing.role !== "DRIVER") throw new z.ZodError([{ code: "custom", path: ["isAvailable"], message: "Driver fields require a driver account" }]);
          result = await tx.user.update({ where: { id }, data: { ...value, ...(driverFields ? { driver: { update: { isAvailable, ...(isAvailable === true && !existing.driver?.isAvailable ? { availableSince: new Date() } : {}), licenseNo: licenseNo === "" ? null : licenseNo, licenseExpiresAt } } } : {}) }, select: { id: true, name: true, email: true, role: true, status: true } });
          if (isAvailable !== undefined && existing.driver && existing.driver.isAvailable !== isAvailable) {
            await enqueueAvailabilityPush(tx, await tx.driverProfile.findUniqueOrThrow({ where: { id: existing.driver.id } }));
          }
        }
        if (entity === "vehicle") {
          const value = updating ? fields.vehicle.partial().parse(data) : fields.vehicle.parse(data);
          result = updating ? await tx.vehicle.update({ where: { id }, data: value }) : await tx.vehicle.create({ data: fields.vehicle.parse(data) });
        }
        if (entity === "hub") {
          const value = updating ? fields.hub.partial().parse(data) : fields.hub.parse(data);
          result = updating ? await tx.hub.update({ where: { id }, data: value }) : await tx.hub.create({ data: fields.hub.parse(data) });
        }
        if (entity === "accounting") result = updating ? await tx.accountingEntry.update({ where: { id }, data: fields.accounting.partial().parse(data) }) : await tx.accountingEntry.create({ data: fields.accounting.parse(data) });
        if (entity === "forecast") result = updating ? await tx.forecastLine.update({ where: { id }, data: fields.forecast.partial().parse(data) }) : await tx.forecastLine.create({ data: fields.forecast.parse(data) });
        if (entity === "pricing") {
          if (updating && (await tx.pricingRule.findUniqueOrThrow({ where: { id } })).policy !== null) throw new z.ZodError([{ code: "custom", path: ["id"], message: "Tariff history is immutable" }]);
          result = updating ? await tx.pricingRule.update({ where: { id }, data: fields.pricing.partial().parse(data) }) : await tx.pricingRule.create({ data: fields.pricing.parse(data) });
        }
        if (entity === "contract") {
          const value = updating ? fields.contract.partial().parse(data) : fields.contract.parse(data);
          const existing = updating ? await tx.vehicleContract.findUniqueOrThrow({ where: { id } }) : null;
          const startsAt = value.startsAt ?? existing?.startsAt;
          const endsAt = value.endsAt === undefined ? existing?.endsAt : value.endsAt;
          const vehicleId = value.vehicleId ?? existing?.vehicleId;
          const vehicle = vehicleId ? await tx.vehicle.findUnique({ where: { id: vehicleId } }) : null;
          if (!vehicle || (!vehicle.active && (!existing || existing.vehicleId !== vehicleId || value.status === "ACTIVE" && existing.status !== "ACTIVE"))) throw new z.ZodError([{ code: "custom", path: ["vehicleId"], message: "Select an active vehicle" }]);
          if (startsAt && endsAt && endsAt < startsAt) throw new z.ZodError([{ code: "custom", path: ["endsAt"], message: "Contract end must follow start" }]);
          result = updating ? await tx.vehicleContract.update({ where: { id }, data: value }) : await tx.vehicleContract.create({ data: fields.contract.parse(data) });
        }
        if (entity === "setting") {
          const value = fields.setting.parse(data);
          if (value.key === farePolicyKey) {
            const effectiveAt = "effectiveAt" in value && value.effectiveAt ? new Date(value.effectiveAt) : new Date();
            if (!await tx.pricingRule.count({ where: { policy: { not: Prisma.DbNull } } })) {
              const prior = await tx.systemSetting.findUnique({ where: { key: farePolicyKey } });
              const baseline = await tx.pricingRule.create({ data: { name: "Transport tariff baseline", amountCents: 0, effectiveAt: new Date(0), policy: farePolicy(prior?.value) } });
              await tx.auditLog.create({ data: { actorId: actor.id, entity: "TransportTariff", entityId: baseline.id, action: "CREATE_BASELINE" } });
            }
            const policy = farePolicy(value.value);
            result = await tx.pricingRule.create({ data: { name: `Transport tariff ${effectiveAt.toISOString()}`, amountCents: 0, effectiveAt, policy } });
            await tx.auditLog.create({ data: { actorId: actor.id, entity: "TransportTariff", entityId: result.id, action: "CREATE", metadata: { policy, effectiveAt: effectiveAt.toISOString() } } });
          } else result = await tx.systemSetting.upsert({ where: { key: value.key }, create: { key: value.key, value: value.value }, update: { value: value.value } });
        }
      }
      await tx.auditLog.create({ data: { actorId: actor.id, entity, entityId: entity === "setting" ? fields.setting.parse(data).key : id ?? null, action: removing ? "ARCHIVE" : updating ? "UPDATE" : "CREATE", ...(entity === "setting" && data.key === gpsRetentionSettingKey ? { metadata: { enabled: data.value === true } } : {}) } });
      return result;
    });
    if (entity === "user" && data.isAvailable !== undefined) schedulePushDelivery();
    return Response.json(removing ? { ok: true } : { item }, { status: updating || removing ? 200 : 201 });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  if (error instanceof DispatchError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid values" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return Response.json({ error: "A record already exists with these unique values" }, { status: 409 });
    if (error.code === "P2025") return Response.json({ error: "Record not found" }, { status: 404 });
    if (error.code === "P2003") return Response.json({ error: "Invalid related record" }, { status: 400 });
  }
  console.error("Admin management request failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
  return Response.json({ error: "Management service unavailable" }, { status: 503 });
}

export const POST = mutate;
export const PATCH = mutate;
export const DELETE = mutate;
