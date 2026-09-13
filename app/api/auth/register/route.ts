import { randomBytes, scryptSync } from "node:crypto";
import { prisma } from "@/lib/prisma";

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
    const body = await request.json() as { name?: string; email?: string; password?: string };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";

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
        role: "CUSTOMER",
        customer: { create: {} },
      },
    });

    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: "customer" } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Registration service unavailable" }, { status: 503 });
  }
}
