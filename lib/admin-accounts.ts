import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import { readEmployer } from "@/lib/employer";
import { contractReadiness, contractSelect, dateOnly } from "@/lib/employment-contracts";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null).nullable().optional();
const phone = z.string().trim().max(30).regex(/^\+?[\d\s().-]*$/).transform((value) => value || null).nullable().optional();
const optionalDate = z.union([z.literal("").transform(() => null), dateOnly]).nullable().optional();

const accountInput = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()).optional(),
  phone,
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
  customer: z.object({
    address: optionalText(500),
    nationality: optionalText(100),
    preferredLanguage: optionalText(50),
    company: optionalText(200),
    adminNotes: optionalText(4000),
  }).strict().optional(),
  driver: z.object({
    isAvailable: z.boolean().optional(),
    licenseNo: optionalText(100),
    licenseCategory: optionalText(50),
    licenseExpiresAt: optionalDate,
    dateOfBirth: optionalDate,
    nationality: optionalText(100),
    idDocumentNo: optionalText(100),
    address: optionalText(500),
    emergencyContactName: optionalText(200),
    emergencyContactPhone: phone,
    adminNotes: optionalText(4000),
  }).strict().optional(),
}).strict();

const accountSelect = {
  id: true, name: true, email: true, phone: true, role: true, status: true, createdAt: true,
  _count: { select: { bookings: true } },
  customer: { select: { address: true, nationality: true, preferredLanguage: true, company: true, adminNotes: true } },
  driver: {
    select: {
      id: true, isAvailable: true, licenseNo: true, licenseCategory: true, licenseExpiresAt: true, dateOfBirth: true, nationality: true, idDocumentNo: true, address: true, emergencyContactName: true, emergencyContactPhone: true, adminNotes: true,
      licenseImages: { select: { side: true, mimeType: true, sizeBytes: true, uploadedAt: true }, orderBy: { side: "asc" } },
      employmentContracts: { select: contractSelect, orderBy: { createdAt: "desc" } },
      _count: { select: { bookings: true } },
    },
  },
} satisfies Prisma.UserSelect;

async function accountDetail(userId: string) {
  const [account, employer] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: accountSelect }), readEmployer()]);
  if (!account) return null;
  const readiness = account.driver ? contractReadiness({ ...account.driver, user: { phone: account.phone } }, employer) : null;
  return { ...account, contractReadiness: readiness };
}

function failure(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid values" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return Response.json({ error: "An account already exists for this email" }, { status: 409 });
    if (error.code === "P2025") return Response.json({ error: "Account not found" }, { status: 404 });
  }
  console.error("Admin account request failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "Account service unavailable" }, { status: 503 });
}

export async function getAccount(request: Request, userId: string) {
  try {
    if (!await authorize(request, "ADMIN")) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const account = await accountDetail(userId);
    return account ? Response.json({ account }, { headers: { "Cache-Control": "no-store" } }) : Response.json({ error: "Account not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function updateAccount(request: Request, userId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    if (userId === admin.id) return Response.json({ error: "Use your own account settings to change your profile" }, { status: 409 });
    const { customer, driver, ...user } = accountInput.parse(await request.json());
    await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true } });
      if (customer && existing.role !== "CUSTOMER") throw new z.ZodError([{ code: "custom", path: ["customer"], message: "Customer fields require a customer account" }]);
      if (driver && existing.role !== "DRIVER") throw new z.ZodError([{ code: "custom", path: ["driver"], message: "Driver fields require a driver account" }]);
      await tx.user.update({
        where: { id: userId },
        data: {
          ...user,
          ...(customer ? { customer: { upsert: { create: customer, update: customer } } } : {}),
          ...(driver ? { driver: { update: driver } } : {}),
        },
      });
      if (user.status === "SUSPENDED") await tx.customerSession.deleteMany({ where: { userId } });
      const fields = [...Object.keys(user), ...Object.keys(customer ?? {}).map((key) => `customer.${key}`), ...Object.keys(driver ?? {}).map((key) => `driver.${key}`)];
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "user", entityId: userId, action: "UPDATE_PROFILE", metadata: { fields } } });
    });
    return Response.json({ account: await accountDetail(userId) });
  } catch (error) { return failure(error); }
}
