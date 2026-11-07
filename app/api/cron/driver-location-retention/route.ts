import { authorizedCron, cronDryRun, cronHead, cronOptions } from "@/lib/cron-auth";
import { prisma } from "@/lib/prisma";
import { gpsRetentionEnabled, gpsRetentionSettingKey } from "@/lib/cron-settings";

export const runtime = "nodejs";
export const maxDuration = 60;
export const OPTIONS = cronOptions;
export const HEAD = cronHead;

export async function GET(request: Request) {
  if (!authorizedCron(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const dryRun = cronDryRun(request);
  if (dryRun === null) return Response.json({ error: "Invalid query; only dryRun=true or dryRun=false is supported" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await prisma.$transaction(async (tx) => {
      const setting = await tx.systemSetting.findUnique({ where: { key: gpsRetentionSettingKey } });
      if (!gpsRetentionEnabled(setting?.value)) return { skipped: true, reason: "DISABLED", removed: 0 };
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (dryRun) {
        const eligible = await tx.driverLocation.count({ where: { recordedAt: { lt: cutoff } } });
        return { dryRun: true, skipped: false, removed: 0, eligible, cutoff };
      }
      const deleted = await tx.driverLocation.deleteMany({ where: { recordedAt: { lt: cutoff } } });
      return { skipped: false, removed: deleted.count, cutoff };
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Driver location retention cleanup failed", { name: error instanceof Error ? error.name : "Unknown error" });
    return Response.json({ error: "Location retention cleanup unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
