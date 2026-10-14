import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { createSession, sessionCookie } from "@/lib/auth-session";
import { activeAccount } from "@/lib/access";

export const runtime = "nodejs";

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const cost = 16384;
  const blockSize = 8;
  const parallelization = 1;
  const derivedKey = scryptSync(password, salt, 64, { N: cost, r: blockSize, p: parallelization });
  return `scrypt$${cost}$${blockSize}$${parallelization}$${salt}$${derivedKey.toString("base64")}`;
}

export async function POST(request: Request) {
  try {
    if (await activeAccount(request)) return Response.json({ error: "Sign out before registering another account" }, { status: 403 });
    const body = await request.json() as { name?: string; email?: string; password?: string; role?: string };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const role = "CUSTOMER" as const;
    if (body.role && body.role.toUpperCase() !== role) return Response.json({ error: "Only customer registration is allowed" }, { status: 403 });

    if (!name || !email || password.length < 8) {
      return Response.json({ error: "Name, email and an 8-character password are required" }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return Response.json({ error: "An account already exists for this email" }, { status: 409 });

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        role,
        customer: { create: {} },
      },
    });

    const session = createSession({ id: user.id, email: user.email, role });
    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: "customer" } }, { status: 201, headers: { "Cache-Control": "no-store", "Set-Cookie": sessionCookie(session) } });
  } catch {
    return Response.json({ error: "Registration service unavailable" }, { status: 503 });
  }
}
