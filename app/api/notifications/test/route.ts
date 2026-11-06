import { randomUUID } from "node:crypto";
import { activeAccount } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { schedulePushDelivery, pushConfiguration } from "@/lib/push-delivery";
import { z } from "zod";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
    if (!pushConfiguration()) return Response.json({ error: "Push not configured" }, { status: 503 });
    const parsed = z.object({ endpoint: z.string().max(2048) }).strict().safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid subscription" }, { status: 400 });
    const queued = await prisma.$transaction(async (tx) => {
      const subscription = await tx.pushSubscription.findFirst({ where: { userId: user.id, endpoint: parsed.data.endpoint } });
      if (!subscription) return 404;
      // Serializes tests on this device, including simultaneous requests.
      await tx.pushSubscription.update({ where: { id: subscription.id }, data: { updatedAt: new Date() } });
      if (await tx.pushDelivery.count({ where: { subscriptionId: subscription.id, kind: "TEST", createdAt: { gt: new Date(Date.now() - 60_000) } } })) return 429;
      await tx.pushDelivery.create({ data: { subscriptionId: subscription.id, eventKey: `test:${randomUUID()}`, kind: "TEST", recipientRole: user.role, expiresAt: new Date(Date.now() + 60_000) } });
      return 202;
    });
    if (queued !== 202) return Response.json({ error: queued === 404 ? "Subscription not found" : "Wait one minute before another test" }, { status: queued });
    schedulePushDelivery();
    return Response.json({ queued: true }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Push notification test failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503 });
  }
}
