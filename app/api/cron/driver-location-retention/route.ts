import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || supplied.length !== secret.length || !timingSafeEqual(Buffer.from(supplied), Buffer.from(secret))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await prisma.driverLocation.deleteMany({ where: { recordedAt: { lt: cutoff } } });
    return Response.json({ removed: result.count, cutoff }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Driver location retention cleanup failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Location retention cleanup unavailable" }, { status: 503 });
  }
}
