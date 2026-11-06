import { z } from "zod";
import { Prisma } from "@prisma/client";
import { activeAccount } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { allowedPushEndpoint } from "@/lib/push-policy";
import { pushConfiguration } from "@/lib/push-delivery";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
const endpoint = z.string().max(2048).refine(allowedPushEndpoint);
const key = z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/);
const subscriptionSchema = z.object({
  endpoint,
  keys: z.object({
    p256dh: key.refine((value) => { const bytes = Buffer.from(value, "base64url"); return bytes.length === 65 && bytes[0] === 4; }),
    auth: key.refine((value) => Buffer.from(value, "base64url").length === 16),
  }).strict(),
  language: z.enum(["en", "fr", "km"]),
}).strict();

export async function GET(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers: noStore });
    const selected = new URL(request.url).searchParams.get("endpoint");
    const subscription = selected ? await prisma.pushSubscription.findFirst({ where: { userId: user.id, endpoint: selected }, select: { id: true, language: true } }) : null;
    const config = pushConfiguration();
    return Response.json({ publicKey: config?.publicKey ?? null, subscription }, { headers: noStore });
  } catch {
    console.error("Push subscription lookup failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503, headers: noStore });
  }
}

export async function POST(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers: noStore });
    if (!pushConfiguration()) return Response.json({ error: "Push not configured" }, { status: 503, headers: noStore });
    const parsed = subscriptionSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid push subscription" }, { status: 400, headers: noStore });
    const { endpoint, keys, language } = parsed.data;
    const subscription = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`;
      const existing = await tx.pushSubscription.findUnique({ where: { endpoint } });
      if (existing && existing.userId !== user.id) return null;
      if (existing) {
        const updated = await tx.pushSubscription.updateMany({ where: { endpoint, userId: user.id }, data: { ...keys, language } });
        return updated.count ? { id: existing.id } : null;
      }
      if (await tx.pushSubscription.count({ where: { userId: user.id } }) >= 20) return null;
      return tx.pushSubscription.create({ data: { endpoint, userId: user.id, ...keys, language }, select: { id: true } });
    });
    if (!subscription) return Response.json({ error: "Device unavailable or account device limit reached" }, { status: 409, headers: noStore });
    return Response.json({ subscription }, { status: 201, headers: noStore });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400, headers: noStore });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "Device subscription changed; retry" }, { status: 409, headers: noStore });
    console.error("Push subscription save failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503, headers: noStore });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await activeAccount(request);
    if (!user) return Response.json({ error: "Sign in required" }, { status: 401, headers: noStore });
    const parsed = z.object({ endpoint }).strict().safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Invalid push subscription" }, { status: 400, headers: noStore });
    await prisma.pushSubscription.deleteMany({ where: { userId: user.id, endpoint: parsed.data.endpoint } });
    return Response.json({ disabled: true }, { headers: noStore });
  } catch {
    console.error("Push subscription removal failed");
    return Response.json({ error: "Notification service unavailable" }, { status: 503, headers: noStore });
  }
}
