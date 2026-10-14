import { createHmac, timingSafeEqual } from "node:crypto";

export type SessionRole = "CUSTOMER" | "DRIVER" | "ADMIN";

type SessionPayload = { id: string; email: string; role: SessionRole; exp: number };

const cookieName = "saiway_session";

function secret() {
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET must be configured");
  return process.env.AUTH_SECRET;
}

function encode(value: string) {
  return Buffer.from(value).toString("base64url");
}

function decode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signature(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function createSession(payload: Omit<SessionPayload, "exp">) {
  const body = encode(JSON.stringify({ ...payload, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }));
  return `${body}.${signature(body)}`;
}

export function readSession(request: Request): SessionPayload | null {
  const cookieHeader = request.headers.get("cookie") || "";
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]+)`));
  if (!match) return null;
  const [body, receivedSignature] = match[1].split(".");
  if (!body || !receivedSignature) return null;
  const expectedSignature = signature(body);
  const received = Buffer.from(receivedSignature);
  const expected = Buffer.from(expectedSignature);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(decode(body)) as SessionPayload;
    return typeof payload.id === "string" && typeof payload.email === "string" && ["ADMIN", "DRIVER", "CUSTOMER"].includes(payload.role) && typeof payload.exp === "number" && payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function clearSessionCookie() {
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function sessionCookie(value: string) {
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
