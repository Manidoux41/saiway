import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sessionCookie } from "@/lib/auth-session";
import type { Prisma } from "@prisma/client";

export function customerSessionToken(request: Request) {
  const token = request.headers.get("cookie")?.match(/(?:^|;\s*)saiway_session=(cs_[a-f0-9]{64})(?:;|$)/)?.[1];
  return token ?? null;
}

export function sessionTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createCustomerSession(userId: string, db: Pick<Prisma.TransactionClient, "customerSession"> = prisma) {
  const token = `cs_${randomBytes(32).toString("hex")}`;
  await db.customerSession.create({ data: { tokenHash: sessionTokenHash(token), userId } });
  return sessionCookie(token, true);
}
