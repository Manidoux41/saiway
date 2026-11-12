import { authorizedCron, cronDryRun, cronHead, cronOptions } from "@/lib/cron-auth";
import { dispatchPush, pushConfiguration } from "@/lib/push-delivery";
import { prisma } from "@/lib/prisma";
import { nativePushConfigured } from "@/lib/native-push";

export const runtime = "nodejs";
export const maxDuration = 60;
export const OPTIONS = cronOptions;
export const HEAD = cronHead;
export async function GET(request: Request) {
  if (!authorizedCron(request)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  const dryRun = cronDryRun(request);
  if (dryRun === null) return Response.json({ error: "Invalid query; only dryRun=true or dryRun=false is supported" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  try {
    if (dryRun) {
      if (!pushConfiguration() && !nativePushConfigured()) return Response.json({ error: "Push not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
      const now = new Date();
      const pending = await prisma.pushDelivery.count({ where: {
        sentAt: null, failedAt: null, expiresAt: { gt: now }, availableAt: { lte: now },
        OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
      } });
      return Response.json({ dryRun: true, configured: true, pending, sent: 0, failed: 0, removed: 0 }, { headers: { "Cache-Control": "no-store" } });
    }
    const result = await dispatchPush();
    if (!result.configured) return Response.json({ error: "Push not configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    const cleanup = await prisma.pushDelivery.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60_000) } } });
    return Response.json({ ...result, removed: cleanup.count }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Push notification cron failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
