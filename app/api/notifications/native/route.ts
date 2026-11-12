import { Prisma } from "@prisma/client";
import { z } from "zod";
import { activeAccount } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { expoTokenSchema, nativeSubscriptionSchema, nativePushConfigured } from "@/lib/native-push";

export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store" };
export async function GET(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers });
    const token = expoTokenSchema.safeParse(new URL(request.url).searchParams.get("token"));
    const subscription = token.success ? await prisma.pushSubscription.findFirst({
      where: { userId: user.id, endpoint: token.data, channel: "EXPO" }, select: { id: true },
    }) : null;
    return Response.json({ configured: nativePushConfigured(), enabled: Boolean(subscription) }, { headers });
  } catch {
    console.error("Native push lookup failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503, headers });
  }
}
export async function POST(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user || !["CUSTOMER", "DRIVER"].includes(user.role)) return Response.json({ error: "Sign in required" }, { status: 401, headers });
    if (!nativePushConfigured()) return Response.json({ error: "Native push not configured" }, { status: 503, headers });
    const parsed = nativeSubscriptionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid native push subscription" }, { status: 400, headers });
    const { token, platform, language } = parsed.data;
    const saved = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const existing = await tx.pushSubscription.findUnique({ where: { endpoint: token } });
      if (existing && (existing.userId !== user.id || existing.channel !== "EXPO")) return false;
      if (existing) {
        await tx.pushSubscription.update({ where: { id: existing.id }, data: { platform, language } });
      } else {
        if (await tx.pushSubscription.count({ where: { userId: user.id } }) >= 20) return false;
        await tx.pushSubscription.create({ data: { userId: user.id, endpoint: token, channel: "EXPO", platform, language, p256dh: "", auth: "" } });
      }
      return true;
    });
    return saved ? Response.json({ enabled: true }, { status: 201, headers })
      : Response.json({ error: "Device unavailable or account device limit reached" }, { status: 409, headers });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) return Response.json({ error: "Invalid native push subscription" }, { status: 400, headers });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Device subscription changed; retry" }, { status: 409, headers });
    console.error("Native push registration failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503, headers });
  }
}
export async function DELETE(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers });
    const parsed = z.object({ token: expoTokenSchema }).strict().safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid native push subscription" }, { status: 400, headers });
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint: parsed.data.token, channel: "EXPO" } });
    return Response.json({ disabled: true }, { headers });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400, headers });
    console.error("Native push removal failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503, headers });
  }
}
