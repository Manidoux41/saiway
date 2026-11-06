import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { gpsRetentionEnabled, gpsRetentionSettingKey } from "@/lib/cron-settings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(secret ?? "");
  const received = Buffer.from(supplied);
  if (!secret || received.length !== expected.length || !timingSafeEqual(received, expected)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const setting = await tx.systemSetting.findUnique({ where: { key: gpsRetentionSettingKey } });
      if (!gpsRetentionEnabled(setting?.value)) return { skipped: true, reason: "DISABLED", removed: 0 };
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const deleted = await tx.driverLocation.deleteMany({ where: { recordedAt: { lt: cutoff } } });
      return { skipped: false, removed: deleted.count, cutoff };
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Driver location retention cleanup failed", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Location retention cleanup unavailable" }, { status: 503 });
  }
}
