import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { activeAccount, authorize } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/passwords";
import { createCustomerSession } from "@/lib/customer-session";
import { professionalDetails, professionalStatuses } from "@/lib/professional-policy";

const registration = professionalDetails.extend({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(8).max(128),
}).strict();
const review = professionalDetails.extend({
  status: z.enum(professionalStatuses),
  updatedAt: z.iso.datetime(),
}).strict();
const userSelect = { id: true, name: true, email: true, status: true, _count: { select: { bookings: true } } } satisfies Prisma.UserSelect;

function failure(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "PRO_INVALID" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return Response.json({ error: "PRO_DUPLICATE" }, { status: 409 });
    if (error.code === "P2025") return Response.json({ error: "PRO_CONFLICT" }, { status: 409 });
  }
  console.error("Professional account request failed", { code: error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "PRO_UNAVAILABLE" }, { status: 503 });
}

export async function registerProfessional(request: Request) {
  try {
    if (await activeAccount(request)) return Response.json({ error: "PRO_SIGN_OUT" }, { status: 403 });
    const { email, password, ...details } = registration.parse(await request.json());
    const cookie = await prisma.$transaction(async tx => {
      const user = await tx.user.create({ data: {
        email, name: details.contactName, phone: details.contactPhone,
        passwordHash: hashPassword(password), role: "CUSTOMER",
        customer: { create: { company: details.companyName, address: details.address } },
        professional: { create: details },
      } });
      await tx.auditLog.create({ data: { actorId: user.id, entity: "ProfessionalProfile", entityId: user.id, action: "REGISTER" } });
      return createCustomerSession(user.id, tx);
    });
    return Response.json({ status: "PENDING" }, { status: 201, headers: { "Set-Cookie": cookie, "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function ownProfessional(request: Request) {
  try {
    const user = await authorize(request, "CUSTOMER");
    if (!user) return Response.json({ error: "PRO_FORBIDDEN" }, { status: 403 });
    const professional = await prisma.professionalProfile.findUnique({ where: { userId: user.id } });
    return Response.json({ professional }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function listProfessionals(request: Request) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "PRO_FORBIDDEN" }, { status: 403 });
    const professionals = await prisma.professionalProfile.findMany({ include: { user: { select: userSelect } }, orderBy: { createdAt: "desc" } });
    return Response.json({ professionals }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function reviewProfessional(request: Request, id: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "PRO_FORBIDDEN" }, { status: 403 });
    const { updatedAt, ...details } = review.parse(await request.json());
    const professional = await prisma.$transaction(async tx => {
      const result = await tx.professionalProfile.update({
        where: { id, updatedAt: new Date(updatedAt) },
        data: { ...details, reviewedAt: new Date() },
        include: { user: { select: userSelect } },
      });
      await tx.customerProfile.update({ where: { userId: result.userId }, data: { company: result.companyName } });
      await tx.auditLog.create({ data: {
        actorId: admin.id, entity: "ProfessionalProfile", entityId: result.id, action: "REVIEW",
        metadata: { status: result.status },
      } });
      return result;
    });
    return Response.json({ professional });
  } catch (error) { return failure(error); }
}
