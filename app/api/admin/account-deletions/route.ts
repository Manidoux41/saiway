import { z } from "zod";
import { authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403, headers });
    const requests = await prisma.accountDeletionRequest.findMany({
      where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 100,
      select: { id: true, createdAt: true, user: { select: { id: true, name: true, email: true, role: true } } },
    });
    return Response.json({ requests }, { headers });
  } catch {
    console.error("Account deletion administration unavailable");
    return Response.json({ error: "Account deletion service unavailable" }, { status: 503, headers });
  }
}
export async function PATCH(request: Request) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403, headers });
    const parsed = z.object({
      id: z.string().min(1), status: z.enum(["COMPLETED", "LIMITED"]),
      resolution: z.string().trim().min(20).max(2000),
    }).strict().safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid deletion resolution" }, { status: 400, headers });
    const { id, status, resolution } = parsed.data;
    const updated = await prisma.$transaction(async tx => {
      const result = await tx.accountDeletionRequest.updateMany({
        where: { id, status: "PENDING" }, data: { status, resolution, resolvedAt: new Date() },
      });
      if (result.count) await tx.auditLog.create({ data: {
        actorId: admin.id, entity: "AccountDeletionRequest", entityId: id,
        action: status, metadata: { resolution },
      } });
      return result.count;
    });
    return updated ? Response.json({ ok: true }, { headers })
      : Response.json({ error: "Deletion request changed; reload" }, { status: 409, headers });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
    console.error("Account deletion resolution failed");
    return Response.json({ error: "Account deletion service unavailable" }, { status: 503, headers });
  }
}
