import "server-only";
import { LicenseSide } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeAccount, authorize } from "@/lib/access";

export const maxLicenseImageBytes = 5 * 1024 * 1024;
const sides = new Set<string>(Object.values(LicenseSide));
const imageMetadata = { side: true, mimeType: true, sizeBytes: true, uploadedAt: true } as const;

export function licenseImageType(bytes: Uint8Array) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

async function ownDriver(request: Request) {
  const account = await authorize(request, "DRIVER");
  if (!account) return null;
  const driver = await prisma.driverProfile.findUnique({ where: { userId: account.id }, select: { id: true } });
  return driver ? { account, driver } : null;
}

function unavailable(error: unknown) {
  console.error("Driver license request failed", { name: error instanceof Error ? error.name : "UNKNOWN" });
  return Response.json({ error: "License service unavailable" }, { status: 503 });
}

export async function driverLicenseSummary(request: Request) {
  try {
    const owner = await ownDriver(request);
    if (!owner) return Response.json({ error: "Driver access required" }, { status: 403 });
    const license = await prisma.driverProfile.findUniqueOrThrow({ where: { id: owner.driver.id }, select: { id: true, licenseNo: true, licenseExpiresAt: true, licenseImages: { select: imageMetadata, orderBy: { side: "asc" } } } });
    return Response.json({ license }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return unavailable(error); }
}

export async function uploadDriverLicense(request: Request) {
  try {
    const owner = await ownDriver(request);
    if (!owner) return Response.json({ error: "Driver access required" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > maxLicenseImageBytes + 64 * 1024) return Response.json({ error: "Image must be 5 MB or smaller" }, { status: 413 });
    let form: FormData;
    try { form = await request.formData(); } catch { return Response.json({ error: "Invalid upload" }, { status: 400 }); }
    const side = form.get("side");
    const file = form.get("file");
    if (typeof side !== "string" || !sides.has(side) || !(file instanceof File)) return Response.json({ error: "Invalid upload" }, { status: 400 });
    if (file.size === 0 || file.size > maxLicenseImageBytes) return Response.json({ error: "Image must be 5 MB or smaller" }, { status: 413 });
    const data = new Uint8Array(await file.arrayBuffer());
    const mimeType = licenseImageType(data);
    if (!mimeType) return Response.json({ error: "Use a JPEG, PNG or WebP photo" }, { status: 415 });
    const image = await prisma.$transaction(async (tx) => {
      const where = { driverId_side: { driverId: owner.driver.id, side: side as LicenseSide } };
      const saved = await tx.driverLicenseImage.upsert({ where, create: { driverId: owner.driver.id, side: side as LicenseSide, mimeType, sizeBytes: data.length, data }, update: { mimeType, sizeBytes: data.length, data, uploadedAt: new Date() }, select: { id: true, ...imageMetadata } });
      await tx.auditLog.create({ data: { actorId: owner.account.id, entity: "DriverLicenseImage", entityId: saved.id, action: `UPLOAD_${side}` } });
      return saved;
    });
    const { id: ignoredId, ...metadata } = image;
    void ignoredId;
    return Response.json({ image: metadata }, { status: 201 });
  } catch (error) { return unavailable(error); }
}

export async function driverLicenseImage(request: Request, driverId: string, side: string) {
  try {
    const account = await activeAccount(request);
    if (!account || !["ADMIN", "DRIVER"].includes(account.role)) return Response.json({ error: "Access denied" }, { status: 403 });
    if (!sides.has(side)) return Response.json({ error: "Not found" }, { status: 404 });
    if (account.role === "DRIVER") {
      const driver = await prisma.driverProfile.findUnique({ where: { userId: account.id }, select: { id: true } });
      if (driver?.id !== driverId) return Response.json({ error: "Access denied" }, { status: 403 });
    }
    const image = await prisma.driverLicenseImage.findUnique({ where: { driverId_side: { driverId, side: side as LicenseSide } }, select: { id: true, mimeType: true, sizeBytes: true, data: true } });
    if (!image) return Response.json({ error: "Not found" }, { status: 404 });
    if (account.role === "ADMIN") await prisma.auditLog.create({ data: { actorId: account.id, entity: "DriverLicenseImage", entityId: image.id, action: "VIEW" } });
    return new Response(Buffer.from(image.data), {
      headers: {
        "Content-Type": image.mimeType,
        "Content-Length": String(image.sizeBytes),
        "Content-Disposition": `inline; filename="license-${side.toLowerCase()}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) { return unavailable(error); }
}
