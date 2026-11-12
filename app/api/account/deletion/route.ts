import { z } from "zod";
import { activeAccount } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/passwords";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers });
    const deletion = await prisma.accountDeletionRequest.findFirst({
      where: { userId: user.id }, orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true },
    });
    return Response.json({ deletion }, { headers });
  } catch {
    console.error("Account deletion lookup failed");
    return Response.json({ error: "Account deletion service unavailable" }, { status: 503, headers });
  }
}
export async function POST(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers });
    const parsed = z.object({ password: z.string().min(1).max(128), confirmed: z.literal(true) }).strict().safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid deletion request" }, { status: 400, headers });
    const account = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!verifyPassword(parsed.data.password, account.passwordHash)) return Response.json({ error: "Invalid credentials" }, { status: 403, headers });
    const deletion = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const existing = await tx.accountDeletionRequest.findFirst({ where: { userId: user.id, status: "PENDING" } });
      return existing ?? tx.accountDeletionRequest.create({ data: { userId: user.id } });
    });
    return Response.json({ deletion: { id: deletion.id, status: deletion.status, createdAt: deletion.createdAt } }, { status: 202, headers });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
    console.error("Account deletion request failed");
    return Response.json({ error: "Account deletion service unavailable" }, { status: 503, headers });
  }
}
