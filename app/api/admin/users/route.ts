import { hashPassword } from "@/lib/passwords";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import { Prisma } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const accountSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "DRIVER", "CUSTOMER"]).default("ADMIN"),
});

export async function POST(request: Request) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const parsed = accountSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "A name, valid email, ADMIN, DRIVER or CUSTOMER role and an 8-character password are required" }, { status: 400 });
    const { name, email, password, role } = parsed.data;
    if (await prisma.user.findUnique({ where: { email } })) return Response.json({ error: "An account already exists for this email" }, { status: 409 });
    const account = await prisma.user.create({ data: { name, email, passwordHash: hashPassword(password), role, ...(role === "DRIVER" ? { driver: { create: {} } } : role === "CUSTOMER" ? { customer: { create: {} } } : { administrator: { create: {} } }) } });
    return Response.json({ user: { id: account.id, name: account.name, email: account.email, role: role.toLowerCase() } }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) return Response.json({ error: "Invalid JSON" }, { status: 400 });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "An account already exists for this email" }, { status: 409 });
    console.error("Admin account creation failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
    return Response.json({ error: "Unable to create account" }, { status: 503 });
  }
}
