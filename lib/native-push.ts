import { z } from "zod";

export const expoTokenSchema = z.string().max(256).regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/);
export const nativeSubscriptionSchema = z.object({
  token: expoTokenSchema,
  platform: z.enum(["android", "ios"]),
  language: z.enum(["fr", "en", "km"]),
}).strict();
const receiptSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ok"), id: z.string().optional() }),
  z.object({ status: z.literal("error"), details: z.object({ error: z.string() }).optional() }),
]);
export class NativePushError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export function nativePushConfigured() {
  return process.env.NATIVE_PUSH_ENABLED === "true" && Boolean(process.env.EXPO_PUSH_ACCESS_TOKEN);
}
async function expoRequest(path: "send" | "getReceipts", body: unknown, transport = fetch) {
  if (!nativePushConfigured()) throw new NativePushError("NOT_CONFIGURED");
  const result = await transport(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${process.env.EXPO_PUSH_ACCESS_TOKEN}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(5000),
  });
  if (!result.ok) throw new NativePushError(`HTTP_${result.status}`);
  const response = z.object({ data: z.unknown() }).parse(await result.json());
  return response.data;
}
export async function sendNativePush(
  token: string, message: { body: string; recipientId: string; bookingId?: string | null; eventKey: string; ttl: number; urgent: boolean },
  transport = fetch,
) {
  expoTokenSchema.parse(token);
  const data = await expoRequest("send", {
    to: token, title: "SAIWAY", body: message.body, sound: "default", channelId: "trips",
    priority: message.urgent ? "high" : "normal", ttl: message.ttl,
    data: { recipientId: message.recipientId, eventKey: message.eventKey, ...(message.bookingId ? { bookingId: message.bookingId } : {}) },
  }, transport);
  const ticket = receiptSchema.parse(data);
  if (ticket.status === "error") throw new NativePushError(ticket.details?.error ?? "PROVIDER_ERROR");
  if (!ticket.id) throw new NativePushError("INVALID_TICKET");
  return ticket.id;
}
export async function nativePushReceipts(ids: string[], transport = fetch) {
  return z.record(z.string(), receiptSchema).parse(await expoRequest("getReceipts", { ids }, transport));
}
