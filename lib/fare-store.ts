import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { farePolicy, farePolicyKey, farePolicySchema } from "@/lib/fare-policy";

export async function activeFarePolicy(at = new Date(), db: Pick<Prisma.TransactionClient, "pricingRule" | "systemSetting"> = prisma) {
  const version = await db.pricingRule.findFirst({ where: { policy: { not: Prisma.DbNull }, active: true, effectiveAt: { lte: at } }, orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }] });
  if (version) return { policy: farePolicySchema.parse(version.policy), tariffId: version.id };
  const setting = await db.systemSetting.findUnique({ where: { key: farePolicyKey } });
  return { policy: farePolicy(setting?.value), tariffId: null };
}
