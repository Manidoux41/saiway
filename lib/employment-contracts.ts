import "server-only";
import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authorize } from "@/lib/access";
import { readEmployer, type Employer } from "@/lib/employer";
import { renderEmploymentContract } from "@/lib/contract-pdf";

export const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform((value, context) => {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    context.addIssue({ code: "custom", message: "Invalid date" });
    return z.NEVER;
  }
  return date;
});

const contractFields = z.object({
  position: z.string().trim().min(1).max(120),
  workplace: z.string().trim().min(1).max(200),
  startsAt: dateOnly,
  probationMonths: z.number().int().min(0).max(3),
  hoursPerWeek: z.number().int().min(1).max(48),
  monthlySalaryCents: z.number().int().min(1).max(100_000_00),
  annualLeaveDays: z.number().int().min(18).max(60),
  additionalTerms: z.string().trim().max(4000).transform((value) => value || null).nullable().optional(),
}).strict();
const contractAction = z.union([
  z.object({ action: z.literal("update"), data: contractFields.partial().strict() }).strict(),
  z.object({ action: z.literal("activate") }).strict(),
  z.object({ action: z.literal("terminate"), terminatedAt: dateOnly }).strict(),
]);

export const contractSelect = { id: true, reference: true, status: true, position: true, workplace: true, startsAt: true, probationMonths: true, hoursPerWeek: true, monthlySalaryCents: true, currency: true, annualLeaveDays: true, additionalTerms: true, activatedAt: true, terminatedAt: true, createdAt: true, updatedAt: true } as const;

type ContractDriver = { dateOfBirth: Date | null; nationality: string | null; idDocumentNo: string | null; address: string | null; licenseNo: string | null; licenseExpiresAt: Date | null; user: { phone: string | null } };

/** Lists what is still missing before a contract can be activated. */
export function contractReadiness(driver: ContractDriver, employer: Employer, now = new Date()) {
  const missing: string[] = [];
  if (!employer.name) missing.push("employerName");
  if (!employer.address) missing.push("employerAddress");
  if (!employer.representative) missing.push("employerRepresentative");
  if (!driver.dateOfBirth) missing.push("dateOfBirth");
  if (!driver.nationality) missing.push("nationality");
  if (!driver.idDocumentNo) missing.push("idDocumentNo");
  if (!driver.address) missing.push("address");
  if (!driver.user.phone) missing.push("phone");
  if (!driver.licenseNo) missing.push("licenseNo");
  if (!driver.licenseExpiresAt) missing.push("licenseExpiresAt");
  else if (driver.licenseExpiresAt.getTime() < now.getTime()) missing.push("licenseExpired");
  return missing;
}

const driverForContract = { id: true, dateOfBirth: true, nationality: true, idDocumentNo: true, address: true, licenseNo: true, licenseCategory: true, licenseExpiresAt: true, user: { select: { name: true, phone: true } } } as const;

class ContractConflict extends Error {
  constructor(public readonly body: Record<string, unknown>) { super("Contract conflict"); }
}

function failure(error: unknown) {
  if (error instanceof ContractConflict) return Response.json(error.body, { status: 409 });
  if (error instanceof z.ZodError || error instanceof SyntaxError) return Response.json({ error: "Invalid values" }, { status: 400 });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") return Response.json({ error: "Not found" }, { status: 404 });
  console.error("Employment contract request failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "Contract service unavailable" }, { status: 503 });
}

const reference = (date: Date) => `EC-${date.getUTCFullYear()}-${randomBytes(4).toString("hex").toUpperCase()}`;

export async function createContract(request: Request, driverId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const data = contractFields.parse(await request.json());
    const contract = await prisma.$transaction(async (tx) => {
      await tx.driverProfile.findUniqueOrThrow({ where: { id: driverId }, select: { id: true } });
      const created = await tx.employmentContract.create({ data: { ...data, driverId, reference: reference(new Date()) }, select: contractSelect });
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "EmploymentContract", entityId: created.id, action: "CREATE", metadata: { driverId } } });
      return created;
    });
    return Response.json({ contract }, { status: 201 });
  } catch (error) { return failure(error); }
}

export async function changeContract(request: Request, contractId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const body = contractAction.parse(await request.json());
    const contract = await prisma.$transaction(async (tx) => {
      const existing = await tx.employmentContract.findUniqueOrThrow({ where: { id: contractId }, select: { id: true, driverId: true, status: true, startsAt: true } });
      // Serialises activations for the same driver so only one contract can be active.
      await tx.$queryRaw`SELECT "id" FROM "DriverProfile" WHERE "id" = ${existing.driverId} FOR UPDATE`;
      let data: Prisma.EmploymentContractUpdateInput;
      if (body.action === "update") {
        if (existing.status !== "DRAFT") throw new ContractConflict({ error: "Only draft contracts can be edited" });
        data = body.data;
      } else if (body.action === "activate") {
        if (existing.status !== "DRAFT") throw new ContractConflict({ error: "Only draft contracts can be activated" });
        const driver = await tx.driverProfile.findUniqueOrThrow({ where: { id: existing.driverId }, select: driverForContract });
        const missing = contractReadiness(driver, await readEmployer(tx));
        if (missing.length) throw new ContractConflict({ error: "Complete the driver and employer details first", missing });
        if (await tx.employmentContract.count({ where: { driverId: existing.driverId, status: "ACTIVE" } })) throw new ContractConflict({ error: "This driver already has an active contract", missing: ["activeContract"] });
        data = { status: "ACTIVE", activatedAt: new Date() };
      } else {
        if (existing.status !== "ACTIVE") throw new ContractConflict({ error: "Only active contracts can be terminated" });
        if (body.terminatedAt < existing.startsAt) throw new z.ZodError([{ code: "custom", path: ["terminatedAt"], message: "Termination must follow the start date" }]);
        data = { status: "TERMINATED", terminatedAt: body.terminatedAt };
      }
      const saved = await tx.employmentContract.update({ where: { id: contractId }, data, select: contractSelect });
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "EmploymentContract", entityId: contractId, action: body.action.toUpperCase(), metadata: { driverId: existing.driverId } } });
      return saved;
    });
    return Response.json({ contract });
  } catch (error) { return failure(error); }
}

export async function deleteContract(request: Request, contractId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    await prisma.$transaction(async (tx) => {
      const existing = await tx.employmentContract.findUniqueOrThrow({ where: { id: contractId }, select: { status: true, driverId: true, reference: true } });
      if (existing.status !== "DRAFT") throw new ContractConflict({ error: "Signed contracts are kept. Terminate the contract instead." });
      await tx.employmentContract.delete({ where: { id: contractId } });
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "EmploymentContract", entityId: contractId, action: "DELETE", metadata: { driverId: existing.driverId, reference: existing.reference } } });
    });
    return Response.json({ ok: true });
  } catch (error) { return failure(error); }
}

export async function contractPdf(request: Request, contractId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const contract = await prisma.employmentContract.findUnique({ where: { id: contractId }, select: { ...contractSelect, driver: { select: driverForContract } } });
    if (!contract) return Response.json({ error: "Not found" }, { status: 404 });
    const employer = await readEmployer();
    const pdf = await renderEmploymentContract({
      ...contract,
      employer,
      employee: { ...contract.driver, name: contract.driver.user.name, phone: contract.driver.user.phone },
      issuedAt: contract.activatedAt ?? new Date(),
    });
    await prisma.auditLog.create({ data: { actorId: admin.id, entity: "EmploymentContract", entityId: contract.id, action: "DOWNLOAD_PDF" } });
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdf.length),
        "Content-Disposition": `attachment; filename="${contract.reference}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) { return failure(error); }
}
