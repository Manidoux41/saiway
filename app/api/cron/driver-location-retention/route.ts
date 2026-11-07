import { authorizedCron } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { gpsRetentionEnabled, gpsRetentionSettingKey } from "@/lib/cron-settings";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!authorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
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
