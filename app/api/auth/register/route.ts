import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { createCustomerSession } from "@/lib/customer-session";
import { activeAccount } from "@/lib/access";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";
const registration = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(128),
  role: z.string().optional(),
}).strict();

export async function POST(request: Request) {
  try {
    if (await activeAccount(request)) return Response.json({ error: "Sign out before registering another account" }, { status: 403 });
    const parsed = registration.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "A valid name, email and password of 8 to 128 characters are required" }, { status: 400 });
    const { name, email, password, role: requestedRole } = parsed.data;
    const role = "CUSTOMER" as const;
    if (requestedRole && requestedRole.toUpperCase() !== role) return Response.json({ error: "Only customer registration is allowed" }, { status: 403 });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return Response.json({ error: "An account already exists for this email" }, { status: 409 });

    const { user, cookie } = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: hashPassword(password),
          role,
          customer: { create: {} },
        },
      });
      const cookie = await createCustomerSession(user.id, tx);
      return { user, cookie };
    });
    return Response.json({ user: { id: user.id, name: user.name, email: user.email, role: "customer" } }, { status: 201, headers: { "Cache-Control": "no-store", "Set-Cookie": cookie } });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "An account already exists for this email" }, { status: 409 });
    return Response.json({ error: "Registration service unavailable" }, { status: 503 });
  }
}
