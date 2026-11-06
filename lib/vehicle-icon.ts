import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { activeAccount, authorize } from "@/lib/access";
import { licenseImageType } from "@/lib/driver-license";

const maxIconBytes = 512 * 1024;
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };

function failure(error: unknown) {
  console.error("Vehicle icon request failed", { code: error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "UNKNOWN" });
  return Response.json({ error: "Vehicle icon service unavailable" }, { status: 503 });
}

export async function vehicleIcon(request: Request, vehicleId: string) {
  try {
    const account = await activeAccount(request);
    if (!account) return Response.json({ error: "Sign in required" }, { status: 401 });
    const scope = account.role === "ADMIN"
      ? {}
      : account.role === "DRIVER"
        ? { bookings: { some: { driver: { userId: account.id } } } }
        : { bookings: { some: { customerId: account.id } } };
    const vehicle = await prisma.vehicle.findFirst({
      where: { id: vehicleId, ...scope },
      select: { iconImage: { select: { mimeType: true, sizeBytes: true, data: true } } },
    });
    if (!vehicle) return Response.json({ error: "Vehicle not found" }, { status: 404 });
    if (!vehicle.iconImage) return Response.json({ error: "Custom icon not found" }, { status: 404 });
    return new Response(new Uint8Array(vehicle.iconImage.data), {
      headers: { ...privateHeaders, "Content-Type": vehicle.iconImage.mimeType, "Content-Length": String(vehicle.iconImage.sizeBytes), "Content-Security-Policy": "default-src 'none'; sandbox" },
    });
  } catch (error) { return failure(error); }
}

export async function saveVehicleIcon(request: Request, vehicleId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    if (Number(request.headers.get("content-length") ?? 0) > maxIconBytes + 64 * 1024) return Response.json({ error: "Icon must be 512 KB or smaller" }, { status: 413 });
    let form: FormData;
    try { form = await request.formData(); } catch { return Response.json({ error: "Invalid upload" }, { status: 400 }); }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Select an image file" }, { status: 400 });
    if (file.size > maxIconBytes) return Response.json({ error: "Icon must be 512 KB or smaller" }, { status: 413 });
    const data = new Uint8Array(await file.arrayBuffer());
    const mimeType = licenseImageType(data);
    if (!mimeType) return Response.json({ error: "Use a JPEG, PNG or WebP image" }, { status: 415 });
    if (!await prisma.vehicle.findUnique({ where: { id: vehicleId }, select: { id: true } })) return Response.json({ error: "Vehicle not found" }, { status: 404 });
    const saved = await prisma.$transaction(async (tx) => {
      const icon = await tx.vehicleIconImage.upsert({
        where: { vehicleId },
        create: { vehicleId, mimeType, sizeBytes: data.length, data },
        update: { mimeType, sizeBytes: data.length, data, uploadedAt: new Date() },
        select: { id: true, sizeBytes: true, uploadedAt: true },
      });
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "VehicleIconImage", entityId: icon.id, action: "UPLOAD", metadata: { vehicleId } } });
      return icon;
    });
    return Response.json({ icon: { sizeBytes: saved.sizeBytes, uploadedAt: saved.uploadedAt } }, { status: 201, headers: privateHeaders });
  } catch (error) { return failure(error); }
}

export async function deleteVehicleIcon(request: Request, vehicleId: string) {
  try {
    const admin = await authorize(request, "ADMIN");
    if (!admin) return Response.json({ error: "Administrator access required" }, { status: 403 });
    const deleted = await prisma.$transaction(async (tx) => {
      const icon = await tx.vehicleIconImage.findUnique({ where: { vehicleId }, select: { id: true } });
      if (!icon) return false;
      await tx.vehicleIconImage.delete({ where: { id: icon.id } });
      await tx.auditLog.create({ data: { actorId: admin.id, entity: "VehicleIconImage", entityId: icon.id, action: "DELETE", metadata: { vehicleId } } });
      return true;
    });
    return deleted ? Response.json({ ok: true }, { headers: privateHeaders }) : Response.json({ error: "Icon not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
