import { scryptSync, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function roleName(role: string) {
  return role.toLowerCase() as "customer" | "driver" | "admin";
}

function verifyPassword(password: string, encodedHash: string) {
  const [algorithm, cost, blockSize, parallelization, salt, storedHash] = encodedHash.split("$");
  if (algorithm !== "scrypt" || !cost || !blockSize || !parallelization || !salt || !storedHash) return false;

  const derivedKey = scryptSync(password, salt, 64, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelization),
  });
  const expectedKey = Buffer.from(storedHash, "base64");
  return expectedKey.length === derivedKey.length && timingSafeEqual(expectedKey, derivedKey);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as { email?: string; password?: string; role?: string };
    const email = body.email?.trim().toLowerCase();
    const password = body.password ?? "";
    const requestedRole = body.role?.toUpperCase();

    if (!email || !password || !["ADMIN", "DRIVER", "CUSTOMER"].includes(requestedRole ?? "")) {
      return Response.json({ error: "Invalid credentials" }, { status: 400 });
    }

    const account = await prisma.user.findUnique({ where: { email } });
    if (!account || account.status !== "ACTIVE" || account.role !== requestedRole || !verifyPassword(password, account.passwordHash)) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    return Response.json(
      { user: { id: account.id, name: account.name, email: account.email, role: roleName(account.role) } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json({ error: "Authentication service unavailable" }, { status: 503 });
  }
}
