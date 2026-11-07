import { authorizedCron } from "@/lib/cron-auth";
import { dispatchPush } from "@/lib/push-delivery";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: Request) {
  if (!authorizedCron(request)) return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    const result = await dispatchPush();
    if (!result.configured) return Response.json({ error: "Push not configured" }, { status: 503 });
    const cleanup = await prisma.pushDelivery.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60_000) } } });
    return Response.json({ ...result, removed: cleanup.count }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Push notification cron failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503 });
  }
}
