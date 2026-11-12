import "server-only";
import { after } from "next/server";
import webpush from "web-push";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { pushCopy } from "@/components/i18n/push-copy";
import { allowedPushEndpoint, pushKinds, urgentPushKinds, type PushKind } from "@/lib/push-policy";
import { pushDeviceToken } from "@/lib/push-device-token";
import { expoTokenSchema, nativePushConfigured, nativePushReceipts, NativePushError, sendNativePush } from "@/lib/native-push";

export function pushConfiguration() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  try {
    if (!/^(mailto:|https:\/\/)/.test(subject)) return null;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return { publicKey, privateKey, subject };
  } catch {
    console.error("Invalid Web Push VAPID configuration");
    return null;
  }
}

export async function dispatchPush(limit = 100, bookingId?: string) {
  const deadline = Date.now() + 15_000;
  const config = pushConfiguration();
  const native = nativePushConfigured();
  if (!config && !native) return { configured: false, sent: 0, failed: 0 };
  if (native) await checkNativePushReceipts();
  const vapidDetails = config;
  const now = new Date();
  const ready = { subscription: { channel: { in: [...(config ? ["WEB"] : []), ...(native ? ["EXPO"] : [])] } }, sentAt: null, failedAt: null, expiresAt: { gt: now }, availableAt: { lte: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] };
  const urgent = await prisma.pushDelivery.findMany({
    where: { ...ready, ...(bookingId ? { bookingId } : {}), kind: { in: [...urgentPushKinds] } },
    orderBy: { createdAt: "asc" }, take: limit, select: { id: true },
  });
  const rest = urgent.length < limit ? await prisma.pushDelivery.findMany({
    where: { ...ready, ...(bookingId ? { bookingId } : {}), kind: { notIn: [...urgentPushKinds] } },
    orderBy: { createdAt: "asc" }, take: limit - urgent.length, select: { id: true },
  }) : [];
  const pending = [...urgent, ...rest];
  let sent = 0, failed = 0;
  async function deliver(id: string) {
    const token = randomUUID();
    const claimed = await prisma.pushDelivery.updateMany({
      where: { id, sentAt: null, failedAt: null, availableAt: { lte: now }, expiresAt: { gt: now }, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      data: { lockToken: token, lockedUntil: new Date(Date.now() + 60_000), attempts: { increment: 1 } },
    });
    if (!claimed.count) return;
    const delivery = await prisma.pushDelivery.findUnique({ where: { id }, include: { subscription: { include: { user: { select: { id: true, status: true, role: true } } } } } });
    if (!delivery) return;
    if (delivery.attempts > 5) {
      await prisma.pushDelivery.updateMany({ where: { id, lockToken: token }, data: { failedAt: new Date(), lastError: "RETRY_LIMIT", lockToken: null, lockedUntil: null } });
      failed++;
      return;
    }
    const { subscription } = delivery;
    const isNative = subscription.channel === "EXPO";
    let allowed = subscription.user.status === "ACTIVE" && subscription.user.role === delivery.recipientRole &&
      (isNative ? expoTokenSchema.safeParse(subscription.endpoint).success : subscription.channel === "WEB" && allowedPushEndpoint(subscription.endpoint));
    if (allowed && delivery.bookingId) {
      const booking = await prisma.booking.findUnique({ where: { id: delivery.bookingId }, select: { customerId: true, driverId: true, status: true, originType: true } });
      if (!booking) allowed = false;
      else if (delivery.kind === "BOOKED") allowed = delivery.recipientRole === "CUSTOMER" && booking.customerId === subscription.userId && !["CANCELLED", "NO_SHOW", "REFUNDED"].includes(booking.status);
      else if (delivery.kind === "NEW_BOOKING") allowed = delivery.recipientRole === "ADMIN";
      else if (delivery.kind === "GUEST_REQUEST") allowed = delivery.recipientRole === "ADMIN" && booking.originType === "GUEST" && !["CANCELLED", "NO_SHOW", "REFUNDED", "TRIP_COMPLETED"].includes(booking.status);
      else if (delivery.kind === "PICKUP_WAITING") allowed = false;
      else if (delivery.kind === "DISPATCHED") allowed = delivery.recipientRole === "ADMIN" && booking.driverId === delivery.driverId && !["CANCELLED", "NO_SHOW", "REFUNDED"].includes(booking.status);
      else if (delivery.kind === "ARRIVED") allowed = booking.customerId === subscription.userId && booking.driverId === delivery.driverId && booking.status === "DRIVER_ARRIVED";
      else if (delivery.kind === "ASSIGNED") allowed = booking.driverId === delivery.driverId && (booking.status === "DRIVER_ASSIGNED" || booking.originType === "GUEST" && ["DRIVER_ACCEPTED", "DRIVER_EN_ROUTE", "DRIVER_ARRIVED"].includes(booking.status)) &&
        Boolean(await prisma.driverProfile.count({ where: { id: booking.driverId ?? "", userId: subscription.userId } }));
    }
    if (allowed && delivery.driverId) allowed = Boolean(await prisma.driverProfile.count({
      where: { id: delivery.driverId, user: { status: "ACTIVE" }, ...(["AVAILABLE", "UNAVAILABLE"].includes(delivery.kind) ? { isAvailable: delivery.kind === "AVAILABLE" } : {}) },
    }));
    if (["AVAILABLE", "UNAVAILABLE"].includes(delivery.kind) && delivery.recipientRole !== "ADMIN") allowed = false;
    if (!allowed || !pushKinds.includes(delivery.kind as PushKind) || delivery.expiresAt <= new Date()) {
      await prisma.pushDelivery.updateMany({ where: { id, lockToken: token }, data: { failedAt: new Date(), lastError: "STALE_OR_UNAUTHORIZED", lockToken: null, lockedUntil: null } });
      failed++;
      return;
    }
    const language = subscription.language === "fr" || subscription.language === "km" ? subscription.language : "en";
    const copy = pushCopy[language];
    const url = delivery.recipientRole === "ADMIN" ? "/admin" : delivery.recipientRole === "DRIVER" ? "/driver" : "/account";
    // No coordinates, addresses, phone numbers or passenger names go to push services.
    const payload = isNative ? "" : JSON.stringify({
      title: "SAIWAY", body: `${copy[`push.${delivery.kind as PushKind}`]}${delivery.reference ? ` (${delivery.reference})` : ""}`,
      tag: delivery.eventKey, lang: language,
      urgent: urgentPushKinds.includes(delivery.kind),
      data: { url, ...(delivery.recipientRole === "DRIVER" && delivery.bookingId ? { bookingId: delivery.bookingId } : {}), subscriptionId: subscription.id, deviceToken: pushDeviceToken(subscription.id, delivery.recipientRole, delivery.expiresAt) },
    });
    try {
      let pushTicketId: string | null = null;
      if (isNative) {
        pushTicketId = await sendNativePush(subscription.endpoint, {
          body: copy[`push.${delivery.kind as PushKind}`], eventKey: delivery.eventKey, recipientId: subscription.userId,
          bookingId: delivery.bookingId, urgent: urgentPushKinds.includes(delivery.kind),
          ttl: Math.max(1, Math.floor((delivery.expiresAt.getTime() - Date.now()) / 1000)),
        });
      } else {
        if (!vapidDetails) throw new Error("Web Push configuration missing");
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, payload, {
          vapidDetails, urgency: urgentPushKinds.includes(delivery.kind) ? "high" : "normal", timeout: 5_000, TTL: Math.max(1, Math.floor((delivery.expiresAt.getTime() - Date.now()) / 1000)),
        });
      }
      await prisma.pushDelivery.updateMany({ where: { id, lockToken: token }, data: { sentAt: new Date(), pushTicketId, lockToken: null, lockedUntil: null, lastError: null } });
      sent++;
    } catch (error) {
      const status = error instanceof webpush.WebPushError ? error.statusCode : 0;
      const nativeCode = error instanceof NativePushError ? error.code : null;
      console.error("Push delivery failed", { deliveryId: id, status, channel: subscription.channel, nativeCode });
      if (status === 404 || status === 410 || nativeCode === "DeviceNotRegistered") {
        await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
      } else {
        const permanent = delivery.attempts >= 5 || status === 400 || status === 413 || nativeCode === "MessageTooBig";
        await prisma.pushDelivery.updateMany({ where: { id, lockToken: token }, data: {
          failedAt: permanent ? new Date() : null, lastError: nativeCode ? `EXPO_${nativeCode}` : `PUSH_${status || "NETWORK"}`,
          availableAt: new Date(Date.now() + Math.min(300_000, 30_000 * 2 ** delivery.attempts)), lockToken: null, lockedUntil: null,
        } });
      }

      failed++;
    }
  }
  for (let offset = 0; offset < pending.length; offset += 5) {
    if (Date.now() >= deadline) break;
    await Promise.all(pending.slice(offset, offset + 5).map(({ id }) => deliver(id)));
  }
  return { configured: true, sent, failed };
}

export async function dispatchPushSafely(bookingId?: string) {
  try {
    const result = await dispatchPush(100, bookingId);
    if (!result.configured) console.error("Push delivery unavailable: no configured channel; events remain queued");
    return result;
  }
  catch {
    console.error("Push queue processing unavailable; committed events remain queued");
    return { configured: false, sent: 0, failed: 0 };
  }
}

export function schedulePushDelivery(bookingId?: string) {
  after(() => dispatchPushSafely(bookingId));
}

async function checkNativePushReceipts() {
  const pending = await prisma.pushDelivery.findMany({
    where: { pushTicketId: { not: null }, receiptCheckedAt: null, sentAt: { lt: new Date(Date.now() - 15 * 60_000) } },
    take: 100, select: { id: true, pushTicketId: true, subscriptionId: true, sentAt: true },
  });
  if (!pending.length) return;
  try {
    const receipts = await nativePushReceipts(pending.flatMap(item => item.pushTicketId ? [item.pushTicketId] : []));
    for (const item of pending) {
      if (!item.pushTicketId) continue;
      const receipt = receipts[item.pushTicketId];
      if (!receipt && item.sentAt && Date.now() - item.sentAt.getTime() < 24 * 60 * 60_000) continue;
      const code = receipt?.status === "error" ? receipt.details?.error ?? "PROVIDER_ERROR" : receipt ? null : "RECEIPT_MISSING";
      if (code) console.error("Native push receipt failed", { deliveryId: item.id, code });
      if (code === "DeviceNotRegistered") await prisma.pushSubscription.deleteMany({ where: { id: item.subscriptionId, channel: "EXPO" } });
      else await prisma.pushDelivery.updateMany({ where: { id: item.id, receiptCheckedAt: null }, data: {
        receiptCheckedAt: new Date(), ...(code ? { failedAt: new Date(), lastError: `EXPO_${code}` } : {}),
      } });
    }
  } catch {
    console.error("Native push receipt lookup unavailable; receipts remain pending");
  }
}
