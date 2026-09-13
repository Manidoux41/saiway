import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/auth-session";

export const runtime = "nodejs";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${salt}$${derivedKey.toString("base64")}`;
}

export async function POST(request: Request) {
  const session = readSession(request);
  if (!session || session.role !== "ADMIN") return Response.json({ error: "Administrator access required" }, { status: 403 });
  try {
    const body = await request.json() as { name?: string; email?: string; password?: string; role?: "ADMIN" | "DRIVER" };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    if (!name || !email || password.length < 8) return Response.json({ error: "Name, email and an 8-character password are required" }, { status: 400 });
    if (await prisma.user.findUnique({ where: { email } })) return Response.json({ error: "An account already exists for this email" }, { status: 409 });
    const role = body.role === "DRIVER" ? "DRIVER" : "ADMIN";
    const account = await prisma.user.create({ data: { name, email, passwordHash: hashPassword(password), role, ...(role === "DRIVER" ? { driver: { create: {} } } : { administrator: { create: {} } }) } });
    return Response.json({ user: { id: account.id, name: account.name, email: account.email, role: role.toLowerCase() } }, { status: 201 });
  } catch {
    return Response.json({ error: "Unable to create administrator" }, { status: 503 });
  }
}
