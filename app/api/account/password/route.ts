import { Prisma } from "@prisma/client";
import { z } from "zod";
import { activeAccount } from "@/lib/access";
import { hashPassword, verifyPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(1024),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(8).max(128),
}).strict().refine((value) => value.newPassword === value.confirmPassword)
  .refine((value) => value.newPassword !== value.currentPassword);

export async function POST(request: Request) {
  const respond = (error: string, status: number) => Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
  try {
    const account = await activeAccount(request);
    if (!account || !["ADMIN", "DRIVER"].includes(account.role)) return respond("FORBIDDEN", 403);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return respond("FORBIDDEN", 403);
    const parsed = passwordSchema.safeParse(await request.json());
    if (!parsed.success) return respond("INVALID_PASSWORD", 400);
    const stored = await prisma.user.findUniqueOrThrow({ where: { id: account.id }, select: { passwordHash: true } });
    if (!verifyPassword(parsed.data.currentPassword, stored.passwordHash)) return respond("INCORRECT_PASSWORD", 400);
    const passwordHash = hashPassword(parsed.data.newPassword);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: account.id, passwordHash: stored.passwordHash, status: "ACTIVE", role: account.role, email: account.email },
        data: { passwordHash },
        select: { id: true },
      });
      await tx.auditLog.create({ data: { actorId: account.id, entity: "User", entityId: account.id, action: "PASSWORD_CHANGE" } });
    });
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof SyntaxError) return respond("INVALID_PASSWORD", 400);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return respond("ACCOUNT_CHANGED", 409);
    console.error("Password change failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
    return respond("SERVICE_UNAVAILABLE", 503);
  }
}
