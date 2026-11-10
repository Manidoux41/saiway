import { createHmac, timingSafeEqual } from "node:crypto";

function signature(value: string) {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be configured");
  return createHmac("sha256", process.env.AUTH_SECRET).update(`push-device:${value}`).digest("base64url");
}

export function pushDeviceToken(subscriptionId: string, role: string, expiresAt: Date) {
  const value = Buffer.from(JSON.stringify({ subscriptionId, role, expiresAt: expiresAt.getTime() })).toString("base64url");
  return `${value}.${signature(value)}`;
}

export function readPushDeviceToken(token: string, subscriptionId: string): { role: "ADMIN" | "DRIVER" | "CUSTOMER" } | null {
  if (token.length > 2000) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [value, received] = parts;
  const expected = Buffer.from(signature(value));
  const actual = Buffer.from(received);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!data || typeof data !== "object" || !("subscriptionId" in data) || data.subscriptionId !== subscriptionId
      || !("role" in data) || (data.role !== "ADMIN" && data.role !== "DRIVER" && data.role !== "CUSTOMER")
      || !("expiresAt" in data) || typeof data.expiresAt !== "number" || data.expiresAt <= Date.now()) return null;
    return { role: data.role };
  } catch { return null; }
}
